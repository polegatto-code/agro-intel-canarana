# MASTER_CONTEXT — AgroIntel Canarana

**Autor:** Manus AI
**Última atualização:** 12 de maio de 2026 — Fase 8
**Base de leitura:** branch `main` — Fase 8: Integração e Ativação Operacional concluída
**Finalidade:** servir como ponto de entrada técnico persistente para futuras sessões de IA, reduzindo releitura do repositório e preservando decisões arquiteturais, estado real da implementação, pendências críticas e regras de continuidade.

> Este arquivo deve ser lido antes de qualquer nova implementação. Ele não substitui o código-fonte; ele compacta o contexto arquitetural essencial e aponta os arquivos que devem ser consultados somente quando uma alteração exigir detalhe local.

## Visão executiva

O AgroIntel Canarana é uma aplicação full-stack de inteligência agrícola voltada ao produtor rural do Vale do Araguaia, inicialmente centrada em Canarana-MT. A plataforma combina **dashboard web**, **coleta climática**, **análise operacional para pulverização**, **monitoramento de mercado agrícola**, **notificações por Telegram**, **persistência em MySQL via Drizzle** e **observabilidade HTTP/Prometheus**. A documentação legada afirma que a versão `1.1.0` está operacional e com páginas de Configurações e Histórico implementadas, mas o estado real do código mostra uma transição em andamento para **multi-fazenda**, com schema e parte do backend já alterados para `farmId`.[1] [2] [3]

A economia de contexto nas próximas sessões depende de não reabrir todo o repositório. Em geral, leia primeiro os arquivos desta pasta, depois apenas o subconjunto de código afetado pela tarefa. Se a tarefa envolver dados, scheduler ou multi-fazenda, os arquivos críticos são `drizzle/schema.ts`, `server/db.ts`, `server/services/scheduler.ts`, `server/services/weather.ts`, `server/routers.ts` e a migration `drizzle/0003_strange_the_santerians.sql`.[4] [5] [6] [7]

| Dimensão | Estado real compactado | Arquivos-fonte de referência |
|---|---|---|
| Produto | Sistema agrícola web com dashboard, configurações, histórico, clima, mercado e Telegram. | `README.md`, `PROJECT_STATE.md`, `CHANGELOG.md` |
| Stack | React 19, Vite, Tailwind CSS 4, Express, tRPC, Drizzle ORM, MySQL, Vitest, Docker. | `package.json`, `server/_core/index.ts`, `drizzle/schema.ts` |
| Persistência | Schema atual possui 10 entidades com multi-fazenda: `users`, `farms`, `farm_users`, `userSettings`, `weatherLogs`, `weatherDailySummary`, `marketAlerts`, `marketAnalysisDaily`, `notificationLogs`, `scheduledJobs`. | `drizzle/schema.ts`, `drizzle/0003_strange_the_santerians.sql` |
| Automação | Há dois mecanismos de agendamento: `scheduler.ts` mais atualizado e multi-fazenda para clima; `cronJobs.ts` está defasado com assinatura antiga. | `server/services/scheduler.ts`, `server/services/cronJobs.ts` |
| Clima | O fluxo principal usa `server/services/weather.ts`, com OpenWeatherMap real, fallback mock, rate limit por `farmId`, classificação operacional e persistência. `openweather.ts` existe como wrapper OO paralelo com cache, mas não é o caminho central observado no scheduler. | `server/services/weather.ts`, `server/services/openweather.ts` |
| Mercado | Coleta notícias, salva alertas, analisa com LLM e envia boletim Telegram; ainda está mais centrado em usuário do que em fazenda. | `server/services/newsCollector.ts`, `server/services/newsAnalysis.ts`, `server/services/scheduler.ts` |
| Frontend | Rotas principais são Dashboard (`/`), Histórico (`/history`) e Configurações (`/settings`). Não há UI multi-fazenda completa no estado observado. | `client/src/App.tsx`, `client/src/pages/Home.tsx`, `client/src/pages/History.tsx`, `client/src/pages/Settings.tsx` |
| Observabilidade | Health endpoints em `/health`, `/live`, `/ready`, métricas Prometheus e serviços de logger/metrics/cache/retry/circuit breaker. | `server/routes/health.ts`, `server/services/metrics.ts`, `server/services/logger.ts` |

## Como continuar sem desperdiçar contexto

Para qualquer sessão futura, a sequência recomendada é curta. Primeiro, leia `docs/context/CURRENT_PHASE.md` para saber a fase real. Depois, leia `docs/context/ENGINEERING_RULES.md` para evitar quebrar decisões anteriores. Em seguida, consulte `docs/context/SYSTEM_MAP.md` apenas se a tarefa exigir arquitetura. Só abra arquivos de código quando a alteração tocar diretamente uma área específica.

| Tipo de tarefa futura | Ler primeiro | Ler código apenas se necessário |
|---|---|---|
| Correção de build ou TypeScript | `CURRENT_PHASE.md`, `SYSTEM_MAP.md` | `server/db.ts`, `server/routers.ts`, `server/services/cronJobs.ts`, `server/services/scheduler.ts` |
| Multi-fazenda | `CURRENT_PHASE.md`, `FUTURE_ROADMAP.md`, `SYSTEM_MAP.md` | `drizzle/schema.ts`, `drizzle/0003_strange_the_santerians.sql`, `server/db.ts`, `server/routers.ts` |
| Clima e OpenWeatherMap | `SYSTEM_MAP.md`, `ENGINEERING_RULES.md` | `server/services/weather.ts`, `server/services/scheduler.ts`, `server/services/openweather.ts` |
| Mercado e LLM | `SYSTEM_MAP.md`, `FUTURE_ROADMAP.md` | `server/services/newsCollector.ts`, `server/services/newsAnalysis.ts`, `server/services/scheduler.ts` |
| Telegram | `SYSTEM_MAP.md` | `server/services/telegram.ts`, `server/services/scheduler.ts`, `server/routers/jobs.ts` |
| Frontend | `CURRENT_PHASE.md`, `SYSTEM_MAP.md` | `client/src/App.tsx`, `client/src/pages/Home.tsx`, `client/src/pages/Settings.tsx`, `client/src/pages/History.tsx`, `client/src/components/DashboardLayout.tsx` |
| Documentação | Estes 5 arquivos | Documentos raiz apenas se a tarefa pedir revisão histórica |

## Estado do produto

A documentação raiz apresenta o projeto como `v1.1.0`, com dashboard, configurações, histórico, automação climática, mercado, Telegram, testes e observabilidade. Esse retrato é útil, mas parcialmente otimista. O código mostra que a base iniciou a implementação técnica de `v1.2` antes de consolidar todas as camadas: o schema já exige `farmId` em várias tabelas, a migration `0003` cria `farms` e `farm_users`, e o scheduler climático já itera fazendas; porém diversas queries e endpoints ainda assumem contexto por `userId` e ignoram `farmId`.[2] [3] [4] [5]

| Área | Funcionalidade declarada | Estado real observado | Risco técnico |
|---|---|---|---|
| Dashboard | Página principal com clima e alertas. | Existe em `Home.tsx`, com rotas configuradas. | Baixo, salvo se dados exigirem `farmId`. |
| Configurações | UI completa para Telegram, thresholds, culturas e insumos. | Existe em `Settings.tsx`; backend `settings` ainda usa `getUserSettings(ctx.user.id)` sem escolher fazenda. | Alto para multi-fazenda, pois `userSettings.farmId` é obrigatório no schema atual. |
| Histórico | UI com clima, mercado e notificações. | Existe em `History.tsx`; queries históricas ainda são centradas em `userId` em parte da camada DB. | Médio/alto por inconsistência de filtros por fazenda. |
| Clima | OpenWeatherMap real por coordenada, análise operacional e persistência. | Fluxo atualizado em `weather.ts` e `scheduler.ts`; `cronJobs.ts` ainda chama assinatura antiga. | Alto se `cronJobService` for iniciado ou testado sem ajuste. |
| Mercado | Coleta de notícias, análise LLM, Telegram. | Implementado, mas menos integrado ao conceito de fazenda. | Médio para isolamento multi-tenant. |
| Multi-fazenda | Plano v1.2 em andamento. | Schema/migration e parte do backend já existem; UI e bootstrap ainda não parecem completos. | Crítico: schema exige `farmId`, mas funções antigas ainda inserem sem ele. |
| Produção | Health, Docker, testes e documentação. | Há infraestrutura, mas validar build/testes antes de qualquer push de feature. | Médio, especialmente por divergências TypeScript prováveis. |

## Arquitetura compactada

A aplicação usa um servidor Express iniciado por `server/_core/index.ts`. Esse arquivo registra rotas de OAuth, proxy de storage, health checks, middleware tRPC em `/api/trpc` e Vite/arquivos estáticos conforme ambiente. Importante: no ponto de entrada observado, não há chamada explícita para `scheduler.start(...)` nem `cronJobService.start()`. Assim, a existência dos serviços de automação não garante que eles sejam ativados no bootstrap atual.[8]

O frontend usa React com `wouter`. As rotas atuais são `/`, `/settings`, `/history` e fallback 404, todas com `DashboardLayout` nas páginas autenticadas principais. O cliente tRPC importa o tipo `AppRouter`, mantendo tipagem end-to-end. Não foi observado seletor de fazenda ativa na UI principal nesta leitura compacta.[9]

| Camada | Responsabilidade | Arquivos centrais |
|---|---|---|
| Entrada HTTP | Express, tRPC, OAuth, health, Vite/static. | `server/_core/index.ts`, `server/_core/oauth.ts`, `server/routes/health.ts` |
| API type-safe | Routers tRPC de auth, settings, weather, marketAlerts, farms, notifications e healthcheck. | `server/routers.ts`, `server/routers/jobs.ts` |
| Persistência | Drizzle ORM com MySQL; funções de usuários, settings, clima, mercado, notificações, jobs e fazendas. | `server/db.ts`, `drizzle/schema.ts` |
| Automação | Agendamento e execução de clima/mercado; integração com Telegram. | `server/services/scheduler.ts`, `server/services/cronJobs.ts` |
| Clima | OpenWeatherMap, fallback, rate limit, classificação, janela e resumo diário. | `server/services/weather.ts`, `server/services/openweather.ts` |
| Mercado | Coleta e análise de notícias agrícolas. | `server/services/newsCollector.ts`, `server/services/newsAnalysis.ts` |
| Resiliência | Cache, deduplicação, rate limiter, retry e circuit breaker. | `server/services/cache.ts`, `server/services/retry.ts`, `server/services/circuitBreaker.ts` |
| Observabilidade | Logs, métricas, health endpoints. | `server/services/logger.ts`, `server/services/metrics.ts`, `server/routes/health.ts` |
| Interface | Dashboard, configurações, histórico e layout. | `client/src/pages/*`, `client/src/components/DashboardLayout.tsx` |

## Modelo de dados real

O schema atual já está desenhado para multi-fazenda. `users` possui `currentFarmId`; `farms` armazena proprietário, nome, município, coordenadas, altitude opcional, cultura principal e janela agrícola; `farm_users` prepara relação N:N e papéis `owner`, `manager`, `viewer`. Todas as tabelas operacionais relevantes possuem `farmId` obrigatório, inclusive `userSettings` e `scheduledJobs`.[4]

Essa decisão aproxima a base do plano `v1.2`, mas também cria o principal risco atual: parte do código de acesso a dados e parte das rotas ainda foram escritas antes da obrigatoriedade de `farmId`. Exemplo: `upsertUserSettings` insere configurações sem `farmId`; `getOrCreateScheduledJob` cria job sem `farmId`; várias leituras históricas filtram por `userId` sem restringir por fazenda; `getAllUsersWithSettings` faz `leftJoin` em settings por usuário, sem resolver qual fazenda representa aquele settings.[5]

| Tabela | Papel | Observação de continuidade |
|---|---|---|
| `users` | Identidade OAuth, role global e fazenda ativa. | Falta consolidar função de atualização de `currentFarmId` em `db.ts`, embora router tente usá-la. |
| `farms` | Cadastro de propriedades por usuário. | CRUD parcial no backend existe. UI completa ainda é roadmap. |
| `farm_users` | Compartilhamento N:N e RBAC futuro. | Base técnica existe, mas autorização granular ainda não está completa. |
| `userSettings` | Thresholds climáticos, Telegram, culturas, insumos e notificações por fazenda. | Inserção atual precisa receber `farmId` consistentemente. |
| `weatherLogs` | Registro climático detalhado com forecast por hora e janela de aplicação. | `weather.ts` já salva com `farmId`. |
| `weatherDailySummary` | Resumo diário climático por fazenda. | `weather.ts` já salva com `farmId`, mas queries antigas ainda filtram por usuário. |
| `marketAlerts` | Alertas/notícias de mercado com análise e impacto. | Schema exige `farmId`; fluxo de mercado ainda parece usuário-cêntrico. |
| `marketAnalysisDaily` | Resumo diário interpretativo de mercado. | Exige `farmId`; confirmar inserções antes de rodar. |
| `notificationLogs` | Histórico de mensagens enviadas. | Exige `farmId`; rotas/histórico precisam respeitar contexto ativo. |
| `scheduledJobs` | Estado de jobs agendados. | Exige `farmId`; helper atual cria sem `farmId`. |

## Automação, clima e mercado

O scheduler mais atual é `server/services/scheduler.ts`. Ele agenda checagem climática em hora específica, alertas de mercado em hora específica, alertas urgentes e fila de retry. Na execução climática, ele busca usuários com settings, filtra quem tem Telegram e notificações climáticas habilitadas, obtém fazendas do usuário, lê settings e chama `executeWeatherCheckForUser(userId, farmId, latitude, longitude, telegramToken, telegramChatId, thresholds...)`. A rotina chama `analyzeWeather`, persiste com `saveWeatherAnalysis` e envia relatório Telegram.[6]

O serviço `server/services/cronJobs.ts` é um mecanismo paralelo. Ele roda clima a cada 6 horas e mercado a cada 12 horas, com execução inicial após 1 minuto. Porém, seu código chama `executeWeatherCheckForUser` com a assinatura antiga, sem `farmId`, `latitude` e `longitude`. Portanto, ele deve ser tratado como **defasado** até ser ajustado ou removido.[10]

| Fluxo | Estado esperado | Estado real e atenção |
|---|---|---|
| Clima via scheduler | Por fazenda, coordenadas reais, thresholds do usuário, Telegram. | Parcialmente pronto; título Telegram ainda menciona `CANARANA-MT`, mesmo usando coordenadas da fazenda. |
| Clima via cronJobService | Periodicidade simples a cada 6h. | Defasado; assinatura quebrada frente ao scheduler atual. |
| Mercado via scheduler | Por usuário, coleta notícias, análise LLM, Telegram. | Funcional em desenho, mas não multi-fazenda completo. |
| OpenWeatherMap OO | Cache e fallback via `openweather.ts`. | Existe, mas o fluxo principal observado usa `weather.ts`. Evitar duplicar lógica sem decidir qual serviço será canônico. |

## Inconsistências críticas a preservar no contexto

A informação mais valiosa para futuras sessões é que o repositório não está apenas em `v1.1.0` estável; ele já contém mudanças de `v1.2` parcialmente integradas. Isso significa que qualquer nova feature deve primeiro estabilizar a transição multi-fazenda. Continuar adicionando funcionalidades sobre queries por `userId` aumentará dívida técnica.

| Inconsistência | Evidência | Impacto provável | Tratamento recomendado |
|---|---|---|---|
| Documentos raiz dizem 9 tabelas; schema tem 10 entidades com `farms` e `farm_users`. | `PROJECT_STATE.md` versus `drizzle/schema.ts`. | Confusão de estado e onboarding de futuras IAs. | Considerar documentos raiz históricos; usar `docs/context` como fonte compacta atual. |
| `userSettings.farmId` é obrigatório, mas `upsertUserSettings` insere sem `farmId`. | `schema.ts`, `server/db.ts`. | Falha de insert após migration aplicada. | Refatorar settings para receber fazenda ativa. |
| `scheduledJobs.farmId` é obrigatório, mas `getOrCreateScheduledJob` insere sem `farmId`. | `schema.ts`, `server/db.ts`. | Falha de insert de jobs. | Tornar job por fazenda ou flexibilizar schema com justificativa. |
| Router tenta `db.updateUser`, mas função não foi observada em `server/db.ts`. | `server/routers.ts`, `server/db.ts`. | Erro de TypeScript/runtime em seleção de fazenda ativa. | Implementar helper ou alterar router. |
| `cronJobs.ts` removido. | N/A | Dívida técnica eliminada na Fase 8. | Resolvido. |
| `getWeatherCacheByFarm` usa `and(eq(...), desc(...))`, misturando predicado com ordenação. | `server/db.ts`. | Query incorreta ou erro de tipagem. | Separar `.where(eq(...)).orderBy(desc(...))`. |
| Mercado ainda é usuário-cêntrico enquanto schema exige `farmId`. | `scheduler.ts`, `newsCollector.ts`, `schema.ts`. | Inserts podem falhar ou dados não isolados. | Definir se mercado é global por usuário ou contextualizado por fazenda; ajustar schema/serviço. |

## Motores de Inteligência — Fase 8 (Operação Autônoma)

O sistema agora opera de forma autônoma com os motores integrados no `scheduler.ts` e ativados no bootstrap (`server/_core/index.ts`).

| Serviço | Estado | Integração |
|---|---|---|
| **Agronômico** | ✅ Ativo | Perfis operacionais e calendário sazonal regional integrados. |
| **Revalidação** | ✅ Ativo | Schedule adaptativo (05h-19h) e anti-spam por fazenda operacionais. |
| **Climático** | ✅ Ativo | Consenso Multi-API (OpenWeather ativo) com fallback. |
| **Mercado** | ✅ Ativo | Inteligência interpretativa e boletins de impacto econômico. |
| **Bootstrap** | ✅ Ativo | Scheduler inicia automaticamente no startup do servidor. |

## Regras de ouro

Não recriar a arquitetura. A base já tem React, tRPC, Express, Drizzle, MySQL, serviços de resiliência, observabilidade e documentação. Não criar dados falsos em produção; mocks devem permanecer apenas como fallback explícito para ausência/falha de API. Não persistir credenciais, tokens ou secrets em arquivos. Não commitar `.env`. Validar `pnpm check`, `pnpm test` e, quando possível, `pnpm build` antes de push.

## References

[1]: ../../PROJECT_STATE.md "PROJECT_STATE.md"
[2]: ../../CHANGELOG.md "CHANGELOG.md"
[3]: ../../TECHNICAL_PLAN_V1.2.md "TECHNICAL_PLAN_V1.2.md"
[4]: ../../drizzle/schema.ts "drizzle/schema.ts"
[5]: ../../server/db.ts "server/db.ts"
[6]: ../../server/services/scheduler.ts "server/services/scheduler.ts"
[7]: ../../drizzle/0003_strange_the_santerians.sql "drizzle/0003_strange_the_santerians.sql"
[8]: ../../server/_core/index.ts "server/_core/index.ts"
[9]: ../../client/src/App.tsx "client/src/App.tsx"
[10]: ../../server/services/cronJobs.ts "server/services/cronJobs.ts"
