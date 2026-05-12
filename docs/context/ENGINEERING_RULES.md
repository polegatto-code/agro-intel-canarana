# ENGINEERING_RULES — Regras de engenharia para o AgroIntel Canarana

**Autor:** Manus AI
**Última atualização:** 12 de maio de 2026
**Escopo:** regras obrigatórias para futuras sessões de desenvolvimento, correção, documentação e operação do AgroIntel Canarana.

> Estas regras existem para proteger a coerência técnica do projeto e reduzir consumo de contexto. Leia este arquivo antes de alterar código. Se uma regra parecer bloquear uma tarefa, registre a exceção no commit e atualize estes documentos.

## Princípio central

A prioridade técnica atual é **estabilizar a transição multi-fazenda antes de criar novas features**. O schema já tornou `farmId` obrigatório em tabelas operacionais; portanto, qualquer alteração que continue usando apenas `userId` em dados de settings, clima, mercado, notificações ou jobs deve ser tratada como dívida técnica e justificada explicitamente.[1] [2]

| Regra | Motivação | Onde aplicar |
|---|---|---|
| Não iniciar feature nova antes de validar contrato multi-fazenda. | Evita construir sobre camada inconsistente. | Backend, DB, frontend e scheduler. |
| Toda operação operacional deve resolver `farmId`. | O schema já exige isolamento por fazenda. | Settings, clima, mercado, notificações, jobs. |
| Não duplicar serviços canônicos. | O projeto já tem cache, retry, circuit breaker e dois wrappers de clima. | `server/services/*`. |
| Não salvar credenciais em arquivos. | Segurança e integridade do repositório. | `.env`, logs, docs e commits. |
| Validar antes de push. | Reduz regressões e sessões futuras caras. | `pnpm check`, `pnpm test`, build quando cabível. |

## Regras de contexto e leitura econômica

Futuras IAs não devem reanalisar o repositório inteiro. A leitura padrão deve começar por `docs/context/MASTER_CONTEXT.md` e `docs/context/CURRENT_PHASE.md`. Em seguida, abrir somente os arquivos diretamente afetados pela tarefa. Documentos raiz como `PROJECT_STATE.md`, `TODO_MASTER.md`, `CHANGELOG.md` e `TECHNICAL_PLAN_V1.2.md` devem ser consultados quando houver necessidade histórica, não como leitura obrigatória em toda sessão.

| Necessidade | Leia estes arquivos | Evite inicialmente |
|---|---|---|
| Entender estado atual | `docs/context/MASTER_CONTEXT.md`, `docs/context/CURRENT_PHASE.md` | Varredura de todo `client/src` ou `server/services`. |
| Alterar backend | `SYSTEM_MAP.md`, arquivo específico do router/serviço. | Reabrir toda documentação raiz. |
| Alterar dados | `drizzle/schema.ts`, `server/db.ts`, migration relevante. | Criar migration sem comparar schema atual. |
| Alterar automação | `scheduler.ts`, `cronJobs.ts`, `weather.ts`, `ENGINEERING_RULES.md`. | Ativar jobs sem validar assinatura e bootstrap. |
| Alterar frontend | `App.tsx`, página/componente afetado. | Reescrever design system ou layout global sem pedido. |

## Regras de segurança e credenciais

Credenciais nunca devem ser exibidas, salvas, comitadas ou documentadas. Tokens de GitHub, chaves de OpenWeatherMap, Telegram, OpenAI ou banco devem permanecer em variáveis de ambiente ou mecanismos seguros de CI/produção. Após operações Git autenticadas, credenciais locais devem ser limpas.

| Proibição | Exemplo | Conduta correta |
|---|---|---|
| Não commitar `.env`. | Arquivo com `DATABASE_URL`, APIs ou tokens. | Usar `.env.example` sem segredos. |
| Não escrever token em remoto persistente. | URL `https://token@github.com/...` salva em `.git/config`. | Usar credential helper temporário ou variável apenas no comando. |
| Não registrar segredo em doc/log. | Colar chave em Markdown ou output. | Referir como variável de ambiente. |
| Não hardcodar API keys. | `const apiKey = "..."`. | Ler de `process.env`. |

## Regras de banco e multi-fazenda

O schema atual é o contrato de verdade. `farmId` é obrigatório em `userSettings`, `weatherLogs`, `weatherDailySummary`, `marketAlerts`, `marketAnalysisDaily`, `notificationLogs` e `scheduledJobs`. Se uma tabela parecer conceitualmente global, a decisão deve ser formalizada antes de mudar código ou schema.[1]

| Operação | Regra obrigatória |
|---|---|
| Criar settings | Receber `userId` e `farmId`; nunca inserir apenas por usuário. |
| Ler settings | Resolver fazenda ativa ou receber `farmId` explícito. |
| Salvar clima | Persistir `userId` e `farmId`, com coordenadas da fazenda. |
| Ler histórico climático | Filtrar por `farmId`; se listar múltiplas fazendas, deixar explícito. |
| Criar alerta de mercado | Definir se é por fazenda ou por usuário; com schema atual, fornecer `farmId`. |
| Registrar notificação | Salvar `farmId` da mensagem ou usar política documentada para notificações globais. |
| Criar job | Definir job por fazenda; inserir `farmId` e `jobType`. |
| Selecionar fazenda ativa | Validar posse/compartilhamento antes de alterar `currentFarmId`. |

Ao alterar `drizzle/schema.ts`, sempre verificar se há migration correspondente. A migration `0003_strange_the_santerians.sql` adiciona multi-fazenda, mas deve ser validada contra dados existentes antes de produção porque adiciona colunas `NOT NULL` sem defaults em tabelas existentes.[3]

## Regras de API e autorização

A API deve manter contratos tRPC tipados. Não crie endpoints REST paralelos para lógica de domínio sem necessidade clara; use REST apenas para health, callbacks ou integrações que não se encaixem em tRPC. Rotas de fazenda devem validar que o usuário é dono ou participante via `farm_users` antes de retornar ou alterar dados.

| Área | Regra |
|---|---|
| `settings` | Não usar apenas `ctx.user.id` para escolher settings; incluir fazenda ativa. |
| `weather` | Operações de leitura devem aceitar/derivar `farmId`. |
| `farms` | `selectActive` precisa validar acesso e atualizar `users.currentFarmId`. |
| `marketAlerts` | Definir escopo e impedir mistura entre fazendas. |
| `notifications` | Histórico deve ser filtrável por fazenda. |
| Jobs manuais | Devem respeitar a mesma lógica do scheduler canônico. |

## Regras de serviços climáticos

O fluxo climático principal observado é `server/services/weather.ts`. Ele já possui classificação operacional, janela de aplicação, fallback mock e rate limit por `farmId`. O arquivo `server/services/openweather.ts` possui wrapper OO com cache/rate limit/fallback, mas não deve ser usado para duplicar responsabilidade sem decisão arquitetural.[4] [5]

| Situação | Conduta recomendada |
|---|---|
| Ajustar classificação operacional | Preferir `weather.ts`, mantendo thresholds configuráveis. |
| Ajustar cache/rate limit | Verificar se a lógica pertence a `weather.ts`, `openweather.ts` ou `cache.ts`; não criar terceiro mecanismo. |
| Alterar fallback mock | Manter fallback explícito e logado; nunca mascarar falha real como dado real. |
| Mensagem Telegram de clima | Corrigir texto para refletir fazenda/município, não fixar Canarana quando coordenadas variam. |
| API externa falha | Usar retry/circuit breaker existentes quando possível. |

## Regras de automação

Há dois serviços de automação: `scheduler.ts` e `cronJobs.ts`. O primeiro está mais alinhado ao multi-fazenda; o segundo está defasado e chama assinatura antiga de execução climática. Antes de ativar qualquer job em produção, escolha ou consolide o mecanismo canônico.[6] [7]

| Regra | Justificativa |
|---|---|
| Não iniciar `cronJobService` sem corrigir assinatura. | Pode quebrar execução climática. |
| Não iniciar dois schedulers equivalentes simultaneamente. | Pode duplicar notificações e inserts. |
| Cada job deve registrar status e erros por fazenda. | Facilita auditoria e retry. |
| Jobs devem respeitar flags de settings. | Usuário pode desativar clima/mercado. |
| Retry deve ser controlado. | Evita spam no Telegram e excesso de API externa. |

## Regras de frontend

O frontend não deve assumir uma única fazenda. Enquanto a UI multi-fazenda não estiver completa, alterações em Dashboard, Histórico e Configurações devem preservar compatibilidade com a futura fazenda ativa. Não codificar município ou coordenadas fixas em componentes novos, salvo como fallback visível.

| Tela | Regra prática |
|---|---|
| Dashboard | Exibir dados da fazenda ativa ou indicar ausência de fazenda configurada. |
| Histórico | Filtrar por fazenda ativa; se mostrar dados globais, rotular. |
| Configurações | Salvar settings da fazenda ativa. |
| Layout | Local natural para seletor de fazenda quando implementado. |
| Componentes UI | Reusar componentes existentes; evitar reescrever design system. |

## Regras de validação

Antes de commit e push, execute validações proporcionais à mudança. Para documentação, validar links e Markdown básico. Para código, priorizar TypeScript e testes. Para migrations, validar geração e compatibilidade com banco existente.

| Tipo de mudança | Validação mínima |
|---|---|
| Documentação | `git diff --check`; leitura rápida dos arquivos criados. |
| Backend TypeScript | `pnpm check`; teste específico se existir. |
| Frontend | `pnpm check`; build quando alterar bundling. |
| Serviços/agendamentos | Teste unitário ou execução controlada; confirmar logs e ausência de duplicidade. |
| Banco/migrations | Revisar SQL gerado, impacto em dados existentes e rollback possível. |
| Segurança | `git status`, `git diff`, busca por padrões de segredo antes de commit. |

## Regras de Git

Commits devem ser pequenos, descritivos e sem credenciais. Para esta linha de trabalho de contexto persistente, o commit deve conter somente arquivos em `docs/context/`. Qualquer alteração acidental em código deve ser revertida antes de push, salvo solicitação explícita.

| Ação | Regra |
|---|---|
| Antes do commit | `git status --short` deve mostrar somente arquivos esperados. |
| Mensagem | Usar português claro ou padrão convencional; exemplo: `docs: adiciona contexto técnico compactado`. |
| Push autenticado | Usar credencial temporária; limpar credenciais locais após push. |
| Após push | Confirmar hash final e persistência no GitHub. |

## References

[1]: ../../drizzle/schema.ts "drizzle/schema.ts"
[2]: ../../TECHNICAL_PLAN_V1.2.md "TECHNICAL_PLAN_V1.2.md"
[3]: ../../drizzle/0003_strange_the_santerians.sql "drizzle/0003_strange_the_santerians.sql"
[4]: ../../server/services/weather.ts "server/services/weather.ts"
[5]: ../../server/services/openweather.ts "server/services/openweather.ts"
[6]: ../../server/services/scheduler.ts "server/services/scheduler.ts"
[7]: ../../server/services/cronJobs.ts "server/services/cronJobs.ts"
[8]: ../../server/routers.ts "server/routers.ts"
