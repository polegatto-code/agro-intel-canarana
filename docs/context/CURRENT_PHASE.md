# CURRENT_PHASE — Fase atual do AgroIntel Canarana

**Autor:** Manus AI
**Última atualização:** 12 de maio de 2026
**Branch base:** `main`
**Commit base da leitura:** `564b5ed35811ef7e431d1b00909c6132e909b814`
**Objetivo deste documento:** indicar, em poucas páginas, onde o projeto realmente está e qual deve ser a próxima sequência segura de trabalho.

> A fase atual não deve ser tratada como “começar novas features”. O estado real exige primeiro consolidar a transição multi-fazenda e remover divergências entre schema, DB helpers, routers e schedulers.

## Diagnóstico da fase

O projeto está entre a conclusão funcional da `v1.1.0` e uma implementação parcial de `v1.2`. A `v1.1.0` documentada inclui dashboard, configurações, histórico, bootstrap de settings, clima, mercado, Telegram, testes e observabilidade. Entretanto, o código atual já introduziu `farms`, `farm_users`, `currentFarmId` e `farmId` obrigatório em tabelas operacionais, o que desloca a base para o início da fase **v1.2 multi-fazenda**.[1] [2] [3]

A leitura correta é: **o produto tem base operacional, mas o código está em uma transição estrutural sensível**. Antes de implementar novas capacidades agronômicas, relatórios, IA ou interface avançada, é necessário estabilizar o contrato multi-fazenda.

| Marcador | Estado observado | Interpretação prática |
|---|---|---|
| Documentação raiz | Afirma `v1.1.0` quase concluída/pronta. | Útil como histórico, mas não é suficiente para guiar novas alterações. |
| Schema Drizzle | Já tem 10 entidades e `farmId` obrigatório em settings, clima, mercado, notificações e jobs. | A base já entrou em `v1.2`. |
| Migration recente | `0003` cria `farms`, `farm_users` e adiciona `farmId`. | Banco versionado foi alterado para multi-fazenda. |
| DB helpers | Misturam funções antigas por `userId` com novas funções por `farmId`. | Principal área de estabilização. |
| Scheduler | `scheduler.ts` usa fazendas no fluxo climático; `cronJobs.ts` está defasado. | Decidir mecanismo canônico antes de ativar jobs em produção. |
| Frontend | Dashboard, Configurações e Histórico existem; UI de fazendas não está completa. | A experiência multi-fazenda ainda precisa ser criada/conectada. |

## Status real por componente

| Componente | Estado | Próxima ação segura |
|---|---|---|
| `drizzle/schema.ts` | Multi-fazenda já modelado. | Não reverter sem decisão explícita. Usar como contrato atual. |
| `drizzle/0003_strange_the_santerians.sql` | Migration multi-fazenda versionada. | Validar compatibilidade com dados existentes antes de produção. |
| `server/db.ts` | CRUD de fazendas existe; várias funções antigas ignoram `farmId`. | Refatorar helpers críticos antes de novas features. |
| `server/routers.ts` | Tem router `farms`; settings/weather/history ainda precisam contexto ativo. | Implementar resolução robusta de fazenda ativa. |
| `server/services/scheduler.ts` | Mais alinhado com multi-fazenda no clima. | Tornar canônico ou documentar uso; ajustar mensagens e settings por fazenda. |
| `server/services/cronJobs.ts` | Defasado, chama assinatura antiga de clima. | Atualizar ou remover do fluxo produtivo. |
| `server/services/weather.ts` | Já opera com `farmId`, coordenadas e rate limit por fazenda. | Manter como serviço climático principal salvo decisão contrária. |
| `server/services/openweather.ts` | Wrapper OO com cache/rate limit/fallback, mas paralelo. | Evitar duplicação; decidir se será absorvido pelo `weather.ts`. |
| Frontend | Rotas principais prontas; sem gestão multi-fazenda completa. | Após backend estável, criar CRUD/seletor de fazenda. |

## Bloqueios técnicos imediatos

A próxima sessão de desenvolvimento deve começar por validação de build/testes e correção das divergências abaixo. Elas têm prioridade maior que features porque podem quebrar compilação, inserts ou execução de jobs.

| Prioridade | Bloqueio | Por que importa | Arquivos prováveis |
|---|---|---|---|
| Crítica | `userSettings.farmId` obrigatório, mas criação de settings ainda não fornece `farmId`. | Novos logins/configurações podem falhar após migration. | `server/db.ts`, `server/_core/oauth.ts`, `server/routers.ts` |
| Crítica | `scheduledJobs.farmId` obrigatório, mas helper cria job sem fazenda. | Rastreamento de jobs pode falhar. | `server/db.ts` |
| Crítica | `cronJobs.ts` chama `executeWeatherCheckForUser` com assinatura antiga. | Pode quebrar TypeScript ou runtime. | `server/services/cronJobs.ts`, `server/services/scheduler.ts` |
| Alta | Router `farms.selectActive` chama `db.updateUser`, não observado em `db.ts`. | Seleção de fazenda ativa pode quebrar. | `server/routers.ts`, `server/db.ts` |
| Alta | Queries históricas e settings filtram por `userId`, não por `farmId`. | Risco de vazamento/ mistura de dados entre fazendas. | `server/db.ts`, `server/routers.ts` |
| Alta | Mercado ainda não tem estratégia clara por fazenda. | Schema exige `farmId`; lógica de alertas é usuário-cêntrica. | `server/services/newsCollector.ts`, `server/services/newsAnalysis.ts`, `server/services/scheduler.ts` |
| Média | Ponto de entrada não inicia scheduler/cron observado. | Automação pode existir no código mas não rodar no servidor. | `server/_core/index.ts`, `server/services/scheduler.ts`, `server/services/cronJobs.ts` |

## Próxima sequência recomendada

A sequência abaixo minimiza risco e consumo de contexto. Não é uma lista de features; é uma ordem de estabilização.

| Ordem | Checkpoint | Critério de conclusão |
|---|---|---|
| 1 | Rodar `pnpm check` e registrar erros reais. | Lista objetiva de erros TypeScript, sem especulação. |
| 2 | Corrigir contrato multi-fazenda mínimo. | `settings`, `farm active`, `weather history` e inserts obrigatórios usam `farmId`. |
| 3 | Escolher scheduler canônico. | `cronJobs.ts` atualizado ou descontinuado; não há duas assinaturas conflitantes. |
| 4 | Consolidar bootstrap de novo usuário. | Primeiro login cria fazenda padrão, vínculo `farm_users` se aplicável, `currentFarmId` e `userSettings` com `farmId`. |
| 5 | Validar testes/build. | `pnpm check`, `pnpm test` e build sem falhas novas. |
| 6 | Só então iniciar UI multi-fazenda. | Seletor/CRUD consomem backend já estabilizado. |

## Definição atual de “pronto para continuar”

Uma próxima sessão pode iniciar novas features quando as seguintes condições forem verdadeiras: o TypeScript compila; os inserts em tabelas com `farmId` obrigatório têm origem de fazenda definida; a seleção de fazenda ativa funciona; há um único fluxo de automação oficialmente usado; e o frontend consome dados da fazenda ativa sem misturar propriedades.

## References

[1]: ../../PROJECT_STATE.md "PROJECT_STATE.md"
[2]: ../../CHANGELOG.md "CHANGELOG.md"
[3]: ../../TECHNICAL_PLAN_V1.2.md "TECHNICAL_PLAN_V1.2.md"
[4]: ../../drizzle/schema.ts "drizzle/schema.ts"
[5]: ../../server/db.ts "server/db.ts"
[6]: ../../server/services/scheduler.ts "server/services/scheduler.ts"
[7]: ../../server/services/cronJobs.ts "server/services/cronJobs.ts"
[8]: ../../server/_core/index.ts "server/_core/index.ts"
