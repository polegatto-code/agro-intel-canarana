# FUTURE_ROADMAP — Roadmap técnico compacto do AgroIntel Canarana

**Autor:** Manus AI
**Última atualização:** 12 de maio de 2026
**Propósito:** orientar futuras sessões sem reabrir todo o planejamento histórico, preservando prioridades reais e evitando novas features antes da estabilização multi-fazenda.

> Este roadmap é técnico e operacional. Ele não substitui o roadmap de produto amplo; ele define a ordem segura de engenharia para transformar a base atual em uma plataforma evolutiva e multi-fazenda.

## Norte estratégico

O AgroIntel Canarana deve evoluir de um dashboard agrícola operacional para uma plataforma multi-fazenda de inteligência agronômica e comercial. O plano histórico `TECHNICAL_PLAN_V1.2.md` aponta nessa direção, e o código atual já iniciou a implementação estrutural com `farms`, `farm_users`, `currentFarmId` e `farmId` obrigatório em tabelas operacionais.[1] [2]

A decisão crítica é não avançar para funcionalidades sofisticadas, como IA agronômica, CBOT, hedge, mapas geoespaciais ou VPD, antes de estabilizar o isolamento de dados por fazenda. Caso contrário, cada feature futura terá que ser refeita.

| Horizonte | Objetivo | Resultado esperado |
|---|---|---|
| Imediato | Estabilizar multi-fazenda mínimo. | Build/testes passam; settings, clima, jobs e histórico usam `farmId`. |
| Curto prazo | Completar UX multi-fazenda. | Usuário cria, seleciona e administra fazendas; dados seguem fazenda ativa. |
| Médio prazo | Consolidar automação confiável. | Scheduler único, logs, métricas e retry por fazenda. |
| Longo prazo | Expandir inteligência agronômica/comercial. | Doenças, ET/VPD, pulverização otimizada, mercado avançado e IA interpretativa. |

## Fase 0 — Estabilização antes de novas features

Esta é a fase atual recomendada. Ela deve ser concluída antes de qualquer incremento de produto. O objetivo é alinhar schema, queries, routers, scheduler e frontend mínimo ao conceito de fazenda ativa.

| Ordem | Entrega | Arquivos prováveis | Critério de pronto |
|---|---|---|---|
| 0.1 | Rodar diagnóstico TypeScript/testes. | `package.json`, projeto inteiro. | Erros reais documentados e corrigidos. |
| 0.2 | Implementar/validar `updateUser` e seleção de fazenda ativa. | `server/db.ts`, `server/routers.ts`. | `farms.selectActive` funciona e valida acesso. |
| 0.3 | Refatorar settings para `farmId`. | `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts`, `client/src/pages/Settings.tsx`. | Criar/ler/salvar settings por fazenda ativa. |
| 0.4 | Corrigir jobs por fazenda. | `server/db.ts`, `server/services/scheduler.ts`, `server/services/cronJobs.ts`. | `scheduledJobs` sempre recebe `farmId`; cron defasado corrigido ou removido. |
| 0.5 | Corrigir históricos por fazenda. | `server/db.ts`, `server/routers.ts`, `client/src/pages/History.tsx`. | Histórico climático/notificações respeita fazenda ativa. |
| 0.6 | Decidir mercado global vs por fazenda. | `schema.ts`, `newsCollector.ts`, `newsAnalysis.ts`, `scheduler.ts`. | Inserts de mercado não falham e escopo fica documentado. |
| 0.7 | Validar build/testes e docs. | Projeto inteiro. | `pnpm check`, `pnpm test` e build quando aplicável. |

## Fase 1 — UX multi-fazenda mínima

Após a estabilização, o usuário precisa controlar as propriedades na interface. O backend já tem base de CRUD de fazendas e relação N:N, mas a experiência visual ainda não está completa. A primeira UX deve ser simples e confiável, não sofisticada.

| Entrega | Descrição | Observação técnica |
|---|---|---|
| Seletor de fazenda ativa | Exibir fazenda atual no layout e permitir troca. | `DashboardLayout` é local natural. |
| CRUD de fazendas | Criar, editar e excluir fazenda com nome, município, coordenadas, altitude, cultura e janela agrícola. | Usar router `farms`; validar ownership. |
| Estado vazio | Orientar usuário sem fazenda a criar primeira propriedade. | Evita erros de dashboard/settings sem `farmId`. |
| Configurações por fazenda | Settings passam a refletir propriedade selecionada. | Não compartilhar thresholds por engano. |
| Fallback de Canarana | Manter Canarana apenas como default explícito se usuário não configurar fazenda. | Nunca mascarar como dado real de outra fazenda. |

## Fase 2 — Automação robusta

Com dados isolados por fazenda, consolidar a automação. A base já tem `scheduler.ts`, `cronJobs.ts`, retry, circuit breaker, cache, métricas e Telegram. A próxima evolução é reduzir duplicidade e garantir execução previsível.

| Entrega | Decisão necessária | Critério de pronto |
|---|---|---|
| Scheduler canônico | Escolher `scheduler.ts` como principal ou reconciliar com `cronJobs.ts`. | Um único fluxo ativo em bootstrap. |
| Bootstrap controlado | Definir onde iniciar jobs e com quais env vars. | Health/ready reflete status do scheduler. |
| Job por fazenda | Registrar execução por `farmId`. | Auditoria e retry granular. |
| Anti-spam Telegram | Deduplicação e rate limit por usuário/fazenda/prioridade. | Sem mensagens duplicadas em retry. |
| Métricas úteis | Métricas por serviço e status de API externa. | Prometheus mostra falhas e latência. |

## Fase 3 — Clima agronômico avançado

Quando o fluxo climático por fazenda estiver confiável, expandir a inteligência agronômica. O serviço atual já classifica janela de aplicação e condições por hora; a evolução natural é enriquecer a análise sem quebrar os contratos existentes.

| Feature | Valor | Dependências |
|---|---|---|
| ET e VPD | Melhor decisão de irrigação, estresse hídrico e pulverização. | Clima histórico confiável por fazenda. |
| Risco de doenças | Alertas por cultura e condição climática. | Cultura principal e janela agrícola corretas. |
| Pulverização otimizada | Recomendação de melhores horários por produto/cultura. | Thresholds por fazenda e forecast confiável. |
| Histórico por talhão | Maior granularidade dentro da fazenda. | Modelo de talhões, ainda não implementado. |
| Mapa climático | Visualização geoespacial das fazendas. | Coordenadas validadas e UI multi-fazenda. |

## Fase 4 — Inteligência comercial

O fluxo de mercado atual monitora notícias e gera análise. A expansão deve começar por definir se alertas são globais por usuário ou por fazenda/cultura. Depois, integrar fontes estruturadas e indicadores.

| Feature | Valor | Atenção |
|---|---|---|
| Fertilizantes | Monitorar ureia, KCl, MAP e superfosfato. | Fontes confiáveis e periodicidade. |
| CBOT/Chicago | Referência internacional para soja/milho. | Preferir API/dados estruturados. |
| Dólar/hedge | Apoiar decisões de venda e compra de insumos. | Separar informação de recomendação financeira. |
| Frete | Impacto regional na margem. | Dados locais podem ser difíceis; documentar fonte. |
| Margem operacional | Cruzar preço, insumo e produtividade. | Requer modelo de custos por fazenda. |

## Fase 5 — IA interpretativa

A IA deve ser introduzida como camada interpretativa sobre dados confiáveis, não como substituta de persistência, regras e validação. O projeto já prevê análise de notícias e mensagens; a evolução pode incluir sumários diários e recomendações, sempre com rastreabilidade de dados usados.

| Capacidade | Diretriz |
|---|---|
| Resumo diário automático | Usar clima, mercado e notificações do dia por fazenda. |
| Interpretação agronômica | Explicar risco e recomendação com base em variáveis observáveis. |
| Recomendação operacional | Apresentar nível de confiança e limitações. |
| Assistente conversacional | Nunca acessar dados de outra fazenda/usuário; respeitar autorização. |
| Auditoria | Registrar dados base, horário e versão da lógica. |

## Decisões arquiteturais pendentes

| Decisão | Opções | Recomendação inicial |
|---|---|---|
| Serviço climático canônico | `weather.ts`, `openweather.ts` ou fusão. | Manter `weather.ts` como fluxo principal e absorver boas partes de `openweather.ts` se necessário. |
| Agendamento canônico | `scheduler.ts`, `cronJobs.ts` ou integração externa. | Usar `scheduler.ts`; corrigir/remover `cronJobs.ts` para evitar duplicidade. |
| Mercado por fazenda | Global por usuário ou específico por fazenda. | Se o schema mantiver `farmId`, tornar explícito por fazenda ativa ou fazenda padrão. |
| Settings por fazenda | Obrigatório ou settings globais com override. | Com schema atual, settings por fazenda. |
| RBAC | Apenas owner inicialmente ou manager/viewer completos. | Começar validando owner; expandir `farm_users` depois. |

## Backlog preservado para sessões futuras

| Prioridade | Item | Pré-requisito |
|---|---|---|
| P0 | Corrigir inconsistências TypeScript e multi-fazenda. | Nenhum; iniciar imediatamente. |
| P0 | Garantir bootstrap de primeira fazenda/settings para novo usuário. | Definir fazenda padrão. |
| P1 | Seletor e CRUD de fazendas no frontend. | Backend multi-fazenda estável. |
| P1 | Scheduler canônico no bootstrap. | Corrigir cron defasado. |
| P1 | Histórico por fazenda. | Queries por `farmId`. |
| P2 | ET/VPD e doenças. | Histórico climático confiável. |
| P2 | Mercado estruturado de fertilizantes/CBOT/dólar. | Escopo de mercado decidido. |
| P3 | Talhões e mapas. | Modelo de fazenda estabilizado. |
| P3 | IA agronômica avançada. | Dados confiáveis e auditoria. |

## Critério de promoção de fase

A fase atual só deve ser promovida quando o projeto compilar, os testes passarem, as tabelas com `farmId` obrigatório tiverem fluxo consistente, o scheduler canônico estiver definido e a UI não depender de pressuposto de fazenda única. Esse critério deve ser registrado no `CHANGELOG.md` ou em documentação equivalente quando concluído.

## References

[1]: ../../TECHNICAL_PLAN_V1.2.md "TECHNICAL_PLAN_V1.2.md"
[2]: ../../drizzle/schema.ts "drizzle/schema.ts"
[3]: ../../drizzle/0003_strange_the_santerians.sql "drizzle/0003_strange_the_santerians.sql"
[4]: ../../server/db.ts "server/db.ts"
[5]: ../../server/services/scheduler.ts "server/services/scheduler.ts"
[6]: ../../server/services/cronJobs.ts "server/services/cronJobs.ts"
[7]: ../../server/services/weather.ts "server/services/weather.ts"
[8]: ../../server/services/newsCollector.ts "server/services/newsCollector.ts"
