# SYSTEM_MAP — Mapa técnico compacto do AgroIntel Canarana

**Autor:** Manus AI
**Última atualização:** 12 de maio de 2026
**Base:** branch `main`, commit `564b5ed35811ef7e431d1b00909c6132e909b814`
**Uso recomendado:** consultar este arquivo antes de alterar arquitetura, rotas, banco, automações, serviços climáticos, mercado, Telegram ou frontend.

> Este mapa descreve a arquitetura observada, não uma arquitetura idealizada. Quando houver divergência entre documentação raiz e código, priorize o código e use este documento como índice para leituras pontuais.

## Topologia geral

O sistema é uma aplicação full-stack com frontend React/Vite e backend Express/tRPC no mesmo projeto. O backend expõe health checks HTTP tradicionais e API tRPC em `/api/trpc`. A persistência usa Drizzle ORM com MySQL. Os serviços de domínio ficam em `server/services`, enquanto os contratos de dados estão em `drizzle/schema.ts`. A interface está em `client/src` e usa `wouter` para rotas.[1] [2] [3]

| Bloco | Tecnologia | Papel | Arquivos principais |
|---|---|---|---|
| Frontend | React 19, Vite, Tailwind CSS, Radix UI, TanStack Query, tRPC client | Dashboard, configurações, histórico e layout autenticado. | `client/src/App.tsx`, `client/src/pages/*`, `client/src/components/*` |
| Backend HTTP | Express, Node HTTP server | Bootstrap, JSON/urlencoded, OAuth, storage proxy, health, tRPC e Vite/static. | `server/_core/index.ts` |
| API type-safe | tRPC | Routers de auth, settings, clima, mercado, fazendas, notificações e health. | `server/routers.ts`, `server/routers/jobs.ts` |
| Banco | MySQL, Drizzle ORM, migrations SQL | Persistência de usuários, fazendas, settings, clima, mercado, notificações e jobs. | `drizzle/schema.ts`, `server/db.ts`, `drizzle/*.sql` |
| Automação | Scheduler customizado e serviço cron paralelo | Checagens climáticas, mercado, alertas urgentes e retry. | `server/services/scheduler.ts`, `server/services/cronJobs.ts` |
| Clima | OpenWeatherMap, parser próprio, fallback mock | Forecast, classificação operacional, janela de aplicação e persistência. | `server/services/weather.ts`, `server/services/openweather.ts` |
| Mercado | Coletor de notícias e análise LLM | Alertas de mercado, boletim diário e mensagem Telegram. | `server/services/newsCollector.ts`, `server/services/newsAnalysis.ts` |
| Notificações | Telegram Bot API, fila com prioridade | Envio, retry, histórico e status de fila. | `server/services/telegram.ts`, `server/db.ts` |
| Resiliência | Cache, dedup, rate limit, retry, circuit breaker | Proteção contra falhas de APIs externas e excesso de chamadas. | `server/services/cache.ts`, `server/services/retry.ts`, `server/services/circuitBreaker.ts` |
| Observabilidade | Health endpoints, Prometheus, logger estruturado | Diagnóstico operacional e métricas. | `server/routes/health.ts`, `server/services/metrics.ts`, `server/services/logger.ts` |

## Bootstrap e execução

O ponto de entrada real é `server/_core/index.ts`. Ele carrega `dotenv/config`, cria app Express e server HTTP, registra parsers, proxy de storage, OAuth, rotas de health, tRPC e, por fim, Vite em desenvolvimento ou arquivos estáticos em produção. Ele procura porta disponível a partir de `PORT` ou `3000`.[1]

O detalhe crítico é que esse bootstrap observado não chama explicitamente `scheduler.start(...)` nem `cronJobService.start()`. Portanto, se a automação estiver funcionando em outro ambiente, a ativação pode estar fora desse arquivo ou ainda pendente. Antes de qualquer mudança em jobs, confirmar o ponto exato de inicialização.

| Etapa | Arquivo | Observação |
|---|---|---|
| Carregar env | `server/_core/index.ts` | Usa `dotenv/config`. |
| Criar app/server | `server/_core/index.ts` | Express + `createServer(app)`. |
| Health | `server/routes/health.ts` | Montado em `/`. |
| tRPC | `server/routers.ts` | Montado em `/api/trpc`. |
| Frontend dev/prod | `server/_core/vite.ts` | Vite em dev; estático em produção. |
| Scheduler | `server/services/scheduler.ts` | Serviço existe, mas não foi visto no bootstrap. |
| Cron paralelo | `server/services/cronJobs.ts` | Existe, mas defasado em relação à assinatura atual de clima. |

## API tRPC compactada

O router principal em `server/routers.ts` contém grupos para autenticação, configurações, clima, alertas de mercado, fazendas, notificações e healthcheck. Há também `server/routers/jobs.ts`, com procedimentos orientados à execução manual e status de jobs. O frontend usa `client/src/lib/trpc.ts`, que importa `AppRouter` para manter tipagem end-to-end.[4]

| Router | Responsabilidade | Atenção atual |
|---|---|---|
| `auth` | Retornar usuário autenticado e estado. | Depende de contexto OAuth. |
| `settings` | Ler e salvar settings do usuário. | Precisa ser refatorado para `farmId`; schema exige settings por fazenda. |
| `weather` | Obter dados climáticos e histórico. | Parte das queries antigas ainda é por usuário; novas funções por fazenda existem. |
| `marketAlerts` | Listar/criar/atualizar alertas de mercado. | Schema exige `farmId`; lógica ainda pode estar usuário-cêntrica. |
| `farms` | CRUD/seleção de fazendas. | Router tenta atualizar usuário/fazenda ativa; helper correspondente deve ser validado. |
| `notifications` | Histórico de notificações. | Schema exige `farmId`; confirmar filtros. |
| `healthcheck` | Status simples via tRPC. | Complementa endpoints HTTP. |

## Modelo de dados e relações

O schema atual deve ser entendido como **multi-fazenda obrigatório**. A tabela `users` mantém identidade e `currentFarmId`. A tabela `farms` representa propriedades com coordenadas e cultura principal. `farm_users` prepara colaboração/RBAC. As tabelas operacionais incluem `farmId` obrigatório, transformando clima, settings, mercado, notificações e jobs em dados contextualizados por fazenda.[2]

| Entidade | Chave contextual | Uso principal | Risco atual |
|---|---|---|---|
| `users` | `id`, `openId`, `currentFarmId` | Identidade, perfil, role e fazenda ativa. | Falta consolidar helper de update de usuário se router depender dele. |
| `farms` | `id`, `userId` | Propriedade rural, localização e cultura principal. | UI e bootstrap inicial ainda precisam amadurecer. |
| `farm_users` | `farmId`, `userId`, `role` | Compartilhamento e RBAC futuro. | Autorização granular ainda incompleta. |
| `userSettings` | `userId`, `farmId` | Telegram, thresholds climáticos, culturas, insumos e flags. | Inserção antiga sem `farmId`. |
| `weatherLogs` | `userId`, `farmId` | Forecast e classificação operacional. | Histórico antigo por usuário pode misturar fazendas. |
| `weatherDailySummary` | `userId`, `farmId` | Resumo diário de clima. | Queries antigas sem filtro por fazenda. |
| `marketAlerts` | `userId`, `farmId` | Alertas de mercado. | Fluxo de mercado precisa decisão por fazenda/global. |
| `marketAnalysisDaily` | `userId`, `farmId` | Resumo de mercado. | Inserções devem fornecer fazenda. |
| `notificationLogs` | `userId`, `farmId` | Auditoria de mensagens. | Histórico precisa respeitar fazenda ativa. |
| `scheduledJobs` | `userId`, `farmId`, `jobType` | Estado de automações. | Helper atual pode criar job sem `farmId`. |

## Fluxo climático

O fluxo climático principal observado está em `server/services/weather.ts` e `server/services/scheduler.ts`. O scheduler busca usuários com settings, filtra quem tem Telegram e clima habilitado, obtém fazendas do usuário, lê configurações e chama a execução por fazenda. A análise usa coordenadas reais da fazenda, API key da OpenWeatherMap quando disponível, fallback mock quando necessário, rate limit por `farmId`, classificação por hora e cálculo de janela de aplicação.[5]

| Passo | Função/arquivo | Resultado |
|---|---|---|
| Selecionar usuários | `db.getAllUsersWithSettings()` | Lista usuários/settings para automação. |
| Selecionar fazendas | `db.getUserFarms(userId)` | Itera propriedades do usuário. |
| Analisar clima | `analyzeWeather(latitude, longitude, settings, apiKey, farmId)` | Forecast, classificação, recomendações e janela. |
| Persistir clima | `saveWeatherAnalysis(userId, analysis, farmId)` | Insere `weatherLogs` e `weatherDailySummary`. |
| Notificar | `telegramService.sendMessage(...)` | Envia relatório ao chat configurado. |

O wrapper `server/services/openweather.ts` também existe e implementa cache, fallback e rate limit, mas sua posição na arquitetura é paralela. Evite modificar simultaneamente `weather.ts` e `openweather.ts` sem decidir qual será a fonte canônica.

## Fluxo de mercado

O fluxo de mercado coleta notícias agrícolas, executa análise interpretativa e envia boletins/alertas por Telegram. Ele está alinhado ao objetivo de inteligência comercial, mas deve ser revisado à luz do schema multi-fazenda, pois o mercado pode ser global por usuário ou contextual por fazenda. Essa decisão deve ser explícita antes de evoluir hedge, CBOT, fertilizantes ou frete.[6] [7]

| Componente | Papel | Observação |
|---|---|---|
| `newsCollectorService` | Busca notícias em fontes agrícolas e mantém cache/estatísticas. | Serve como insumo bruto. |
| `newsAnalysisService` | Classifica, resume e gera mensagem Telegram. | Pode usar LLM conforme configuração. |
| `scheduler.ts` | Orquestra análise diária e alertas urgentes. | Ainda mais centrado em usuário. |
| `marketAlerts` / `marketAnalysisDaily` | Persistem alertas e análises. | Exigem `farmId` no schema atual. |

## Frontend e navegação

A aplicação frontend tem três rotas principais autenticadas: Dashboard em `/`, Histórico em `/history` e Configurações em `/settings`, além de NotFound. `DashboardLayout` organiza a navegação lateral. O estado observado não apresenta UI completa de fazendas ou seletor de fazenda ativa, apesar do backend já possuir router `farms`.[8]

| Tela | Arquivo | Papel | Próxima evolução provável |
|---|---|---|---|
| Dashboard | `client/src/pages/Home.tsx` | Visão principal com dados agrícolas. | Consumir fazenda ativa. |
| Histórico | `client/src/pages/History.tsx` | Histórico de clima, alertas e notificações. | Filtrar por fazenda ativa e permitir troca de fazenda. |
| Configurações | `client/src/pages/Settings.tsx` | Telegram, thresholds, culturas e insumos. | Tornar configurações por fazenda. |
| Layout | `client/src/components/DashboardLayout.tsx` | Sidebar e estrutura autenticada. | Adicionar seletor/indicador de fazenda. |

## Observabilidade e resiliência

O backend possui rotas de health e métricas, além de serviços de retry, circuit breaker, cache, deduplicação e rate limiter. Essas peças devem ser reutilizadas em novas integrações; não crie retry/cache ad hoc sem verificar serviços existentes.

| Capacidade | Arquivos | Regra de uso |
|---|---|---|
| Health HTTP | `server/routes/health.ts` | Manter leve e sem dependências externas lentas. |
| Métricas | `server/services/metrics.ts` | Registrar execução de serviços, chamadas externas e alertas. |
| Retry | `server/services/retry.ts` | Reusar `weatherRetry`, `newsRetry` e `telegramRetry` quando aplicável. |
| Circuit breaker | `server/services/circuitBreaker.ts` | Usar para APIs instáveis. |
| Cache/dedup/rate limit | `server/services/cache.ts` | Evitar duplicação em serviços novos. |

## References

[1]: ../../server/_core/index.ts "server/_core/index.ts"
[2]: ../../drizzle/schema.ts "drizzle/schema.ts"
[3]: ../../package.json "package.json"
[4]: ../../server/routers.ts "server/routers.ts"
[5]: ../../server/services/weather.ts "server/services/weather.ts"
[6]: ../../server/services/newsCollector.ts "server/services/newsCollector.ts"
[7]: ../../server/services/newsAnalysis.ts "server/services/newsAnalysis.ts"
[8]: ../../client/src/App.tsx "client/src/App.tsx"
