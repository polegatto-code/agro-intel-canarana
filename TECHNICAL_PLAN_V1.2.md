# Plano Técnico para AgroIntel Canarana v1.2: Plataforma Multi-Fazenda

## Objetivo Principal

Transformar o sistema AgroIntel Canarana em uma plataforma agrícola multi-fazenda real, orientada por dados climáticos, mercado agrícola e inteligência operacional contínua, mantendo a robustez e escalabilidade da arquitetura existente.

## Regras Importantes

- **NÃO** recriar arquitetura existente.
- **NÃO** remover funcionalidades atuais.
- **NÃO** quebrar compatibilidade.
- **NÃO** mockar dados.
- **NÃO** simplificar persistência.
- **NÃO** criar IA fake.
- Executar incrementalmente.
- Validar build após cada etapa.
- Validar testes continuamente.
- Criar commits pequenos e frequentes.
- Atualizar `PROJECT_STATE.md`, `TODO_MASTER.md` e `CHANGELOG.md` ao final de cada checkpoint.
- Realizar push automático no GitHub após checkpoints importantes.
- Limpar credenciais após push.

## Foco Técnico da Fase v1.2

### 1. Multi-Fazenda Real

#### Estrutura de Dados e Migrations

Para suportar múltiplas fazendas por usuário, será necessário introduzir novas tabelas e modificar as existentes para estabelecer o vínculo `usuário ↔ fazendas` e garantir o isolamento multi-tenant.

**Tabelas Impactadas:**

| Tabela | Impacto | Detalhes |
|---|---|---|
| `users` | Adicionar `currentFarmId` (FK para `farms.id`) | Indica a fazenda ativa do usuário para contexto de UI. |
| `farms` | **NOVA TABELA** | Armazenará dados da fazenda: `id`, `userId` (FK para `users.id`), `name`, `latitude`, `longitude`, `municipio`, `altitude` (opcional), `mainCrop`, `agriculturalWindowStart`, `agriculturalWindowEnd`, `createdAt`, `updatedAt`. |
| `farm_users` | **NOVA TABELA** | Tabela pivô para relacionamento N:N entre `users` e `farms`, permitindo múltiplos usuários por fazenda e múltiplos fazendas por usuário (futuro RBAC). Campos: `farmId`, `userId`, `role` (e.g., `owner`, `manager`, `viewer`). |
| `userSettings` | Adicionar `farmId` (FK para `farms.id`) | As configurações do usuário serão específicas por fazenda. |
| `weatherLogs` | Adicionar `farmId` (FK para `farms.id`) | Registros climáticos serão vinculados a uma fazenda específica. |
| `marketAlerts` | Adicionar `farmId` (FK para `farms.id`) | Alertas de mercado podem ser específicos por fazenda (e.g., culturas monitoradas). |
| `notifications` | Adicionar `farmId` (FK para `farms.id`) | Notificações serão enviadas no contexto de uma fazenda. |

**Migrations Necessárias:**

1.  Criação da tabela `farms`.
2.  Criação da tabela `farm_users`.
3.  Adição da coluna `currentFarmId` à tabela `users`.
4.  Adição da coluna `farmId` às tabelas `userSettings`, `weatherLogs`, `marketAlerts`, `notifications`.
5.  Atualização dos schemas Drizzle (`drizzle/schema.ts`).

#### Arquivos Impactados (Backend e Frontend)

-   **Backend (`server/`):**
    -   `db.ts`: Funções de acesso a dados precisarão ser atualizadas para incluir `farmId` em todas as operações relevantes e garantir o isolamento. Novas funções para CRUD de fazendas.
    -   `routers.ts`: Novos endpoints para CRUD de fazendas (`/api/farms`), seleção de fazenda ativa (`/api/users/current-farm`). Endpoints existentes (`/api/settings`, `/api/weather`, etc.) precisarão ser modificados para aceitar `farmId` ou inferi-lo do `currentFarmId` do usuário.
    -   `_core/oauth.ts`: No bootstrap, além de `userSettings`, será necessário criar uma fazenda padrão para o novo usuário e vincular `currentFarmId`.
    -   `_core/cron.ts`: O scheduler precisará iterar sobre as fazendas ativas de cada usuário para coletar dados climáticos e gerar alertas de mercado por fazenda.
    -   `services/*`: Serviços como `weather`, `marketAlerts`, `notifications` precisarão ser refatorados para operar no contexto de uma `farmId`.
-   **Frontend (`client/`):**
    -   `App.tsx`: Gerenciamento de estado global para a fazenda ativa (e.g., via Context API ou Zustand).
    -   `DashboardLayout.tsx`: Adicionar seletor de fazenda ativa na UI.
    -   `pages/Home.tsx`, `pages/Settings.tsx`, `pages/History.tsx`: Todas as páginas precisarão exibir dados da fazenda ativa e permitir a seleção de fazendas.
    -   Novas páginas/componentes para CRUD de fazendas (e.g., `pages/FarmManagement.tsx`, `components/FarmSelector.tsx`).

#### Riscos de Scheduler e Persistência

-   **Scheduler (`cron.ts`):** A principal preocupação é a escalabilidade. Atualmente, o scheduler executa tarefas globalmente. Com múltiplas fazendas, ele precisará iterar sobre cada fazenda para coletar dados climáticos e gerar alertas. Isso pode levar a um aumento significativo na carga de trabalho. Será necessário otimizar as consultas ao banco de dados e considerar estratégias de paralelização ou fila de mensagens (e.g., Redis Queue) para tarefas intensivas. O isolamento de dados por `farmId` deve ser rigorosamente aplicado para evitar vazamento de informações entre fazendas.
-   **Persistência (`db.ts`):** Todas as operações de leitura e escrita que envolvem dados específicos de fazenda ou usuário precisarão incluir o `farmId` como critério de filtro ou inserção. Isso garante que um usuário só possa acessar e modificar dados de fazendas às quais ele tem permissão. A complexidade das queries aumentará, exigindo atenção à performance e indexação adequada das novas colunas.

### 2. Clima Real por Coordenada

Cada fazenda terá `latitude` e `longitude`. A integração com a API do OpenWeatherMap será feita utilizando essas coordenadas. Isso garante dados climáticos precisos para cada localização específica da fazenda.

**Validação:**

-   **Scheduler:** O cron job de coleta climática (`cron.ts`) será modificado para buscar as coordenadas de cada fazenda ativa e fazer chamadas individuais à API do OpenWeatherMap. Será crucial gerenciar o rate limit da API para evitar bloqueios.
-   **Cache Climático:** Implementar um cache local (e.g., Redis ou cache em memória) para as respostas da API climática, reduzindo chamadas redundantes e melhorando a performance. O cache deve ser invalidado periodicamente ou por fazenda.
-   **Rate Limit:** Monitorar e respeitar os limites de requisição da API do OpenWeatherMap. Implementar um mecanismo de `retry` com `exponential backoff` em caso de falhas de rate limit.
-   **Logs:** Logs detalhados para cada chamada à API climática, incluindo `farmId`, coordenadas, status da requisição e tempo de resposta, serão essenciais para depuração e monitoramento.

### 3. Sistema Agronômico Real

O sistema será expandido para suportar novas culturas (`milheto`, `sorgo`, `gergelim`). As recomendações agronômicas (janela ideal de pulverização, risco climático, risco fitossanitário, monitoramento de umidade, vento, temperatura, chuva) serão baseadas **SOMENTE** em fontes confiáveis (Embrapa, artigos científicos, universidades reconhecidas, APIs climáticas com credibilidade internacional). **NÃO** serão geradas recomendações inventadas.

-   A lógica de recomendação será encapsulada em um serviço (`agronomyService.ts`) que receberá os dados climáticos da fazenda e as configurações do usuário (`userSettings`) para gerar as recomendações.
-   Será necessário um mapeamento de parâmetros ideais por cultura para as recomendações.

### 4. Inteligência de Mercado Agrícola

O monitoramento de mercado será expandido para incluir uma gama mais ampla de fatores (fertilizantes, sementes, defensivos, commodities agrícolas, logística, exportação, geopolítica global, macroeconomia). O objetivo é identificar impactos indiretos no agronegócio brasileiro.

-   Será necessário integrar novas fontes de notícias internacionais e dados econômicos.
-   A análise contextual e a classificação de impacto serão aprimoradas, possivelmente utilizando modelos de LLM para processar e sumarizar informações de diversas fontes, identificando correlações e impactos relevantes para o setor agrícola.
-   O `marketAlertsService` será refatorado para consumir essas novas fontes e gerar alertas mais abrangentes e preditivos.

### 5. CRUD Completo de Fazendas

Serão implementadas funcionalidades completas de Cadastro, Edição, Exclusão e Seleção de Fazenda Ativa. Um usuário poderá ter múltiplas fazendas associadas.

-   **Backend:** Novos endpoints para `POST /api/farms` (criar), `GET /api/farms` (listar), `GET /api/farms/:id` (obter), `PUT /api/farms/:id` (atualizar), `DELETE /api/farms/:id` (excluir), `POST /api/users/select-farm` (selecionar fazenda ativa).
-   **Frontend:** Formulários e tabelas para gerenciar fazendas, além de um componente de seleção de fazenda ativa que atualiza o contexto da aplicação.

### 6. Docker e Produção

O ambiente de produção será preparado para o cenário multi-fazenda, garantindo escalabilidade, segurança e observabilidade.

-   **Dockerfile:** Otimização para builds multi-stage, garantindo imagens menores e mais seguras.
-   **docker-compose:** Atualização do `docker-compose.yml` para incluir serviços adicionais (e.g., Redis para cache/fila) e configurar volumes persistentes para o banco de dados.
-   **Variáveis Seguras:** Gerenciamento de segredos (API keys, tokens) via variáveis de ambiente do Docker ou Docker Secrets, evitando hardcoding.
-   **Healthcheck:** Adicionar healthchecks aos serviços no `docker-compose.yml` para garantir que os contêineres estejam funcionando corretamente.
-   **Restart Policy:** Configurar políticas de restart (`restart: always`) para garantir alta disponibilidade.
-   **Persistência:** Garantir que os volumes de dados do banco de dados sejam persistentes e configurados corretamente.
-   **Logs:** Configurar drivers de log para centralização (e.g., `json-file` ou `syslog`) e rotação de logs.

## Próximos Passos (Ordem de Implementação)

1.  **Elaborar Plano Técnico v1.2** (Concluído nesta etapa).
2.  **Implementar Estrutura de Banco de Dados Multi-Fazenda:** Criar migrations para as novas tabelas (`farms`, `farm_users`) e adicionar `farmId` às tabelas existentes. Atualizar `drizzle/schema.ts`.
3.  **Desenvolver CRUD de Fazendas e Isolamento Multi-tenant no Backend:** Implementar endpoints para gerenciar fazendas e refatorar serviços existentes para garantir o isolamento de dados por `farmId`.
4.  **Implementar Clima Real por Coordenada e Refatorar Scheduler:** Modificar o cron job para coletar dados climáticos por fazenda, implementar cache e rate limit.
5.  **Expandir Sistema Agronômico e Inteligência de Mercado:** Adicionar suporte a novas culturas e aprimorar a análise de mercado com novas fontes.
6.  **Desenvolver Interface Frontend para Gestão Multi-Fazenda:** Criar UI para CRUD de fazendas e seletor de fazenda ativa.
7.  **Configurar Ambiente Docker e Produção:** Atualizar Dockerfile e docker-compose para o novo cenário.
8.  **Validar Build, Executar Testes Finais e Persistir no GitHub.**
9.  **Reportar Conclusão da Fase v1.2 ao Usuário.**

Este plano detalha as etapas necessárias para a transição do AgroIntel Canarana para uma plataforma multi-fazenda, garantindo a integridade dos dados, a escalabilidade e a aderência aos requisitos de negócio.
