# Relatório Técnico Consolidado — AgroIntel Canarana

**Autor:** Manus AI
**Data:** 12 de maio de 2026
**Fase Atual:** Fase 5 Concluída (Agro & Mercado)

Este relatório consolida o estado atual do projeto AgroIntel Canarana, detalhando a arquitetura, fluxos implementados, estrutura de dados e diretrizes para a continuidade segura do desenvolvimento.

## 1. Arquitetura Atual do Sistema

O AgroIntel Canarana é uma aplicação full-stack de inteligência agrícola voltada ao produtor rural, com foco inicial no Vale do Araguaia (Canarana-MT). A arquitetura é baseada em um modelo cliente-servidor com comunicação fortemente tipada via tRPC. O sistema foi projetado para ser multi-tenant (multi-fazenda), permitindo que um único usuário gerencie múltiplas propriedades com isolamento lógico de dados.

A aplicação utiliza um servidor Express que expõe rotas tRPC, gerencia autenticação OAuth e serve o frontend estático (ou via Vite em desenvolvimento). A persistência é feita em um banco de dados relacional (MySQL/TiDB) utilizando Drizzle ORM. Processos assíncronos e agendados (como coleta de clima e mercado) são gerenciados por um serviço interno de `scheduler`.

## 2. Stack Utilizada

A stack tecnológica do projeto é moderna e focada em produtividade e segurança de tipos:

*   **Frontend:** React 19, Vite, Tailwind CSS 4, Lucide React, Wouter (roteamento).
*   **Backend:** Node.js, Express, tRPC.
*   **Banco de Dados:** MySQL/TiDB.
*   **ORM:** Drizzle ORM.
*   **Autenticação:** Manus OAuth.
*   **Integrações Externas:** OpenWeatherMap API (clima), Telegram Bot API (notificações), LLM (análise de mercado).
*   **Ferramentas de Qualidade:** TypeScript, Vitest, Docker.

## 3. Backend Implementado

O backend está estruturado em serviços modulares e rotas tRPC. A entrada principal (`server/_core/index.ts`) configura o Express, middlewares, rotas de health check e o endpoint tRPC.

A camada de acesso a dados (`server/db.ts`) centraliza as queries do Drizzle ORM. A lógica de negócios está dividida em serviços específicos na pasta `server/services/`, como `agronomyService.ts`, `weather.ts`, `scheduler.ts`, `newsCollector.ts` e `telegram.ts`.

O backend já suporta a estrutura multi-fazenda, exigindo `farmId` na maioria das operações operacionais e de configuração.

## 4. Frontend Implementado

O frontend é uma Single Page Application (SPA) em React. As rotas principais identificadas são:

*   `/`: Dashboard principal (exibe clima, alertas e score operacional).
*   `/settings`: Configurações do usuário e da fazenda (Telegram, thresholds climáticos, culturas monitoradas).
*   `/history`: Histórico de dados climáticos, mercado e notificações.

O frontend utiliza um hook customizado `useFarms` para gerenciar o contexto da fazenda ativa e `skipToken` do tRPC para aguardar a resolução da fazenda antes de buscar dados dependentes.

## 5. Serviços Existentes

Os principais serviços implementados no backend são:

*   **`agronomyService`:** Motor agronômico. Contém o catálogo de culturas, cálculo de Delta T, avaliação de risco de chuva e geração do boletim agronômico.
*   **`scheduler`:** Gerenciador de tarefas agendadas (cron jobs internos) para checagem de clima e mercado.
*   **`weather` / `openweather`:** Integração com a API do OpenWeatherMap, incluindo fallback, rate limiting e persistência de logs climáticos.
*   **`newsCollector` / `newsAnalysis`:** Coleta de notícias agrícolas e análise de impacto utilizando LLM.
*   **`telegram`:** Serviço de envio de mensagens e alertas via Telegram.
*   **Serviços de Resiliência:** `cache`, `retry`, `circuitBreaker`.
*   **Observabilidade:** `logger`, `metrics`, `healthcheck`.

## 6. Fluxo do Scheduler

O `scheduler.ts` é o coração da automação do sistema. Ele é inicializado com horários específicos para checagem de clima e mercado.

1.  **Inicialização:** O método `start` configura intervalos que rodam a cada minuto, verificando se a hora atual corresponde à hora agendada.
2.  **Execução Climática (`executeWeatherCheck`):**
    *   Busca todos os usuários com configurações ativas.
    *   Filtra usuários com Telegram configurado e notificações climáticas habilitadas.
    *   Itera sobre as fazendas do usuário.
    *   Chama `executeWeatherCheckForUser` passando as coordenadas da fazenda e thresholds.
3.  **Execução de Mercado (`executeMarketAlerts`):**
    *   Busca usuários com notificações de mercado habilitadas.
    *   Chama `executeMarketAnalysisForUser`.

*Nota: Existe um serviço legado `cronJobs.ts` que utiliza assinaturas antigas e deve ser descontinuado.*

## 7. Fluxo Telegram

O envio de mensagens via Telegram é integrado aos fluxos de clima e mercado através do `telegramService`.

1.  O usuário configura seu `telegramToken` e `telegramChatId` na página de Settings.
2.  O `scheduler` utiliza essas credenciais ao executar os jobs.
3.  O `agronomyService` formata a mensagem (ex: `formatAgronomicBulletin`) utilizando HTML para negrito, itálico e emojis.
4.  O `telegramService.sendMessage` envia a mensagem para a API do Telegram, suportando níveis de prioridade (que podem influenciar em filas de retry ou alertas urgentes).

## 8. Fluxo Agronômico

O fluxo agronômico é centralizado no `agronomyService.ts`.

1.  **Catálogo:** O sistema possui um catálogo (`CROP_CATALOG`) com parâmetros técnicos para Soja, Milho, Sorgo, Milheto e Gergelim (janelas de plantio, exigências climáticas para pulverização, etc.).
2.  **Análise (`analyzeAgronomicConditions`):** Recebe dados climáticos atuais e o nome da cultura.
3.  **Cálculos:** Calcula o Delta T e avalia temperatura, umidade e vento contra os limites da cultura.
4.  **Score:** Gera um `sprayScore` (0-100) que define a recomendação de pulverização ("recomendado", "aceitavel", "nao-recomendado").
5.  **Boletim:** A função `formatAgronomicBulletin` consolida a análise climática, recomendação de manejo, alertas técnicos e notícias de mercado em uma única mensagem para o Telegram.

## 9. Fluxo de Mercado

O monitoramento de mercado visa alertar o produtor sobre eventos que impactam suas culturas.

1.  **Coleta:** O `newsCollectorService` busca notícias agrícolas de fontes configuradas.
2.  **Persistência:** As notícias brutas são salvas no banco de dados.
3.  **Análise IA:** O `newsAnalysisService` utiliza um LLM para analisar as notícias, extrair insights, identificar culturas/insumos afetados e definir o nível de impacto (baixo, médio, alto).
4.  **Filtragem:** Na geração do boletim ou na listagem do frontend, os alertas são filtrados com base nas `monitoredCrops` configuradas para a fazenda.
5.  **Notificação:** Um resumo diário ou alertas críticos são enviados via Telegram.

## 10. Estrutura Multi-Fazenda

O sistema migrou de um modelo centrado no usuário para um modelo multi-tenant baseado em fazendas (`farmId`).

*   **Tabelas:** A tabela `farms` armazena os dados da propriedade (nome, município, coordenadas, cultura principal). A tabela `farm_users` permite o compartilhamento de acesso (RBAC futuro).
*   **Isolamento:** Tabelas operacionais como `userSettings`, `weatherLogs`, `marketAlerts` e `crops` possuem a chave estrangeira `farmId`.
*   **Contexto:** O usuário possui um `currentFarmId` na tabela `users` para definir a fazenda ativa na sessão.
*   **API:** Os endpoints tRPC (ex: `settings.get`, `weather.getHistory`) exigem o `farmId` como parâmetro de entrada para garantir o isolamento dos dados.

## 11. Estrutura de Crops (Culturas)

A Fase 5 introduziu a tabela `crops` para armazenar metadados agronômicos específicos por fazenda.

*   **Bootstrap:** Ao criar uma fazenda, a função `getDefaultCropsForFarm` popula a tabela com as 5 culturas padrão do catálogo, copiando os parâmetros técnicos.
*   **Personalização:** O produtor pode, teoricamente, ajustar os parâmetros (ex: `minTempSpray`, `expectedYieldBagHa`) para a sua realidade específica através de endpoints tRPC de `upsert`.
*   **Integração:** A cultura principal da fazenda (`farms.mainCrop`) é utilizada pelo scheduler para gerar a análise agronômica diária.

## 12. Como funciona o Delta T

O Delta T é o principal indicador para a viabilidade de pulverização agrícola, representando a taxa de evaporação da gota.

1.  **Cálculo do Ponto de Orvalho:** O sistema utiliza a fórmula de Magnus simplificada a partir da temperatura e umidade relativa.
2.  **Cálculo do Delta T:** É a diferença entre a temperatura do ar e o ponto de orvalho (`Temperatura - Ponto de Orvalho`).
3.  **Classificação:**
    *   `< 2°C`: Crítico (Risco de inversão térmica e deriva).
    *   `2°C a 8°C`: Ideal (Condições ótimas).
    *   `8°C a 10°C`: Aceitável (Requer cautela com evaporação).
    *   `> 10°C`: Crítico (Evaporação excessiva).

## 13. Como funciona a Análise Operacional

A análise operacional (`analyzeAgronomicConditions`) gera um score de viabilidade para operações de campo, especificamente pulverização.

1.  **Base:** Inicia com um score de 100.
2.  **Penalidades:** Subtrai pontos se as condições climáticas atuais violarem os limites da cultura:
    *   Temperatura fora do limite: -25 a -30 pontos.
    *   Umidade fora do limite: -15 a -20 pontos.
    *   Vento acima do máximo: -35 pontos.
    *   Delta T crítico: -40 pontos; Aceitável: -10 pontos.
    *   Risco de chuva alto: -30 pontos; Moderado: -10 pontos.
3.  **Recomendação:**
    *   `Score >= 70`: Recomendado.
    *   `Score >= 40`: Aceitável.
    *   `Score < 40`: Não recomendado.

## 14. Como funciona o Filtro de Mercado

O filtro de mercado garante que o produtor receba apenas notícias relevantes para o seu negócio.

1.  **Configuração:** O usuário define as `monitoredCrops` (ex: `['soja', 'milho']`) nas configurações da fazenda (`userSettings`).
2.  **Análise IA:** Quando uma notícia é coletada, a IA identifica quais culturas são afetadas e salva no campo `affectedCrops` do alerta.
3.  **Filtragem na API:** O endpoint `marketAlerts.list` pode receber a flag `filterByMonitoredCrops`. Se verdadeira, a query no banco de dados retorna apenas os alertas onde há interseção entre as `affectedCrops` da notícia e as `monitoredCrops` da fazenda.
4.  **Filtragem no Telegram:** O boletim agronômico também filtra os alertas exibidos com base nas culturas monitoradas.

## 15. Como funciona o Boletim Telegram

O Boletim Agronômico é uma mensagem unificada gerada diariamente pelo `scheduler`.

1.  O `scheduler` coleta os dados climáticos atuais e a previsão.
2.  Chama a análise agronômica para a cultura principal da fazenda.
3.  Busca os últimos alertas de mercado filtrados pelas culturas monitoradas.
4.  A função `formatAgronomicBulletin` constrói a mensagem em HTML, dividida em seções:
    *   **Cabeçalho:** Nome da fazenda e emoji de status geral.
    *   **Clima Operacional:** Delta T, Temperatura, Umidade, Vento e Risco de Chuva.
    *   **Recomendação de Manejo:** Status (Recomendado/Não Recomendado) e justificativa.
    *   **Alertas Técnicos:** Avisos específicos (ex: "Vento acima do máximo").
    *   **Mercado:** Lista de notícias relevantes com emojis de impacto.
5.  A mensagem é enviada via `telegramService`.

## 16. Principais Endpoints tRPC

O roteador principal (`appRouter`) expõe os seguintes sub-roteadores e endpoints críticos:

*   **`settings`:** `get`, `update` (gerencia configurações por `farmId`).
*   **`weather`:** `getCurrent`, `getHistory`, `recordWeather`.
*   **`marketAlerts`:** `list` (com filtro de culturas), `create`, `markNotificationSent`.
*   **`farms`:** `list`, `get`, `create`, `update`, `delete`, `selectActive` (atualiza o `currentFarmId` do usuário).
*   **`crops`:** `list`, `getById`, `upsert`, `deactivate`, `analyzeConditions`, `seasonStatus`.
*   **`notifications`:** `getHistory`.

## 17. Principais Serviços do Sistema

*   `server/services/agronomyService.ts`: Lógica agronômica e formatação de boletins.
*   `server/services/scheduler.ts`: Agendamento de tarefas (clima e mercado).
*   `server/services/weather.ts`: Integração com OpenWeatherMap e persistência climática.
*   `server/services/newsCollector.ts` & `newsAnalysis.ts`: Coleta e análise de mercado via LLM.
*   `server/services/telegram.ts`: Envio de notificações.
*   `server/db.ts`: Camada de acesso a dados (Drizzle ORM).

## 18. Estrutura de Banco de Dados

O schema (`drizzle/schema.ts`) define as seguintes tabelas principais:

*   `users`: Autenticação e `currentFarmId`.
*   `farms`: Cadastro de propriedades (coordenadas, cultura principal).
*   `farm_users`: Relação N:N para compartilhamento de acesso.
*   `userSettings`: Configurações específicas por `farmId` (Telegram, thresholds, culturas monitoradas).
*   `weatherLogs` & `weatherDailySummary`: Histórico climático por `farmId`.
*   `marketAlerts` & `marketAnalysisDaily`: Alertas de mercado e análises da IA por `farmId`.
*   `crops`: Catálogo agronômico personalizado por `farmId`.
*   `scheduledJobs`: Controle de execução de tarefas em background.
*   `notificationLogs`: Histórico de mensagens enviadas.

## 19. Arquivos Mais Importantes

*   `drizzle/schema.ts`: Definição da estrutura de dados e relacionamentos.
*   `server/db.ts`: Implementação das queries e mutações no banco de dados.
*   `server/routers.ts`: Definição da API tRPC e contratos de comunicação.
*   `server/services/agronomyService.ts`: Regras de negócio agronômicas.
*   `server/services/scheduler.ts`: Orquestração dos processos automatizados.
*   `docs/context/MASTER_CONTEXT.md`: Documentação arquitetural e estado real do projeto.

## 20. Dependências Críticas

*   **Drizzle ORM:** Essencial para a persistência e tipagem do banco de dados.
*   **tRPC:** Base da comunicação cliente-servidor type-safe.
*   **OpenWeatherMap API:** Fonte primária de dados climáticos.
*   **Telegram Bot API:** Canal exclusivo de notificações proativas.
*   **LLM (OpenAI/Gemini):** Motor de análise de notícias de mercado.

## 21. O que já está pronto

*   Autenticação e fluxo de bootstrap (criação de fazenda padrão).
*   Estrutura de banco de dados multi-fazenda.
*   Motor agronômico (Delta T, score operacional, catálogo de culturas).
*   Integração com OpenWeatherMap e persistência de logs.
*   Coleta de notícias e análise via LLM.
*   Geração e envio do Boletim Agronômico unificado via Telegram.
*   Endpoints tRPC para configurações, clima, mercado, fazendas e culturas.
*   Filtragem de mercado baseada em culturas monitoradas.

## 22. O que ainda NÃO existe

*   Interface de Usuário (UI) completa para gerenciamento de múltiplas fazendas (CRUD de fazendas no frontend).
*   Interface de Usuário para edição dos parâmetros agronômicos das culturas (`crops`).
*   Sistema de permissões granulares (RBAC) implementado nas rotas para os papéis definidos em `farm_users` (owner, manager, viewer).
*   Integração com APIs de preços de commodities em tempo real (atualmente baseado em notícias).
*   Análises sazonais e histórico de longo prazo de Delta T.

## 23. Funcionalidades Parcialmente Prontas

*   **Seleção de Fazenda:** O backend possui a rota `farms.selectActive` e o frontend o hook `useFarms`, mas a UI de seleção global (ex: um dropdown no header) pode não estar totalmente integrada em todas as telas.
*   **Mercado:** O fluxo de mercado no `scheduler` (`executeMarketAnalysisForUser`) ainda parece iterar por usuários e não estritamente por fazendas, o que pode gerar inconsistências se um usuário tiver fazendas com culturas muito diferentes.

## 24. Funcionalidades Experimentais

*   **Análise de Mercado via LLM:** A extração de entidades (`affectedCrops`, `affectedInputs`) e a definição de impacto dependem da interpretação do LLM, o que pode ser não-determinístico.
*   **Classificação Operacional:** Os pesos das penalidades no `sprayScore` são heurísticos e podem precisar de calibração com dados reais de campo.

## 25. Bugs Conhecidos

*   **Serviço Legado:** O arquivo `server/services/cronJobs.ts` utiliza assinaturas antigas de funções (ex: `executeWeatherCheckForUser` sem `farmId`) e causará erros se for ativado.
*   **Inconsistências de Inserção:** Algumas funções utilitárias antigas podem tentar inserir dados em tabelas que agora exigem `farmId` sem fornecê-lo (ex: `getOrCreateScheduledJob` mencionado no `MASTER_CONTEXT.md`).

## 26. Limitações Atuais

*   **Fonte de Dados Climáticos:** Dependência exclusiva do OpenWeatherMap. Falta de integração com estações meteorológicas locais da fazenda.
*   **Resolução Espacial:** A previsão climática é baseada em uma única coordenada por fazenda, o que pode ser impreciso para propriedades muito grandes (comuns no Mato Grosso).
*   **Notificações:** Limitado ao Telegram. Não há suporte para WhatsApp, SMS ou Push Notifications nativas no app.

## 27. Gargalos Técnicos

*   **Rate Limiting:** A API do OpenWeatherMap e a API do Telegram possuem limites de requisições. O `scheduler` precisa garantir que não exceda esses limites ao iterar sobre muitos usuários/fazendas simultaneamente.
*   **Custo de LLM:** A análise diária de notícias para múltiplos usuários pode gerar custos elevados de API de IA se não houver deduplicação eficiente das notícias antes da análise.

## 28. Pontos de Risco

*   **Transição Multi-Fazenda Incompleta:** Se rotas antigas ou queries no frontend ainda assumirem o contexto por `userId` em vez de `farmId`, dados de diferentes fazendas podem vazar ou ser sobrescritos.
*   **Concorrência no Scheduler:** Se a execução do job de clima demorar mais que o intervalo de agendamento, pode haver sobreposição de execuções.

## 29. O que precisa refatorar

*   **Remover Código Legado:** Excluir ou atualizar completamente o `server/services/cronJobs.ts` para usar a nova arquitetura do `scheduler.ts`.
*   **Padronizar Queries:** Revisar `server/db.ts` para garantir que **todas** as queries operacionais (clima, mercado, settings) incluam o `farmId` na cláusula `where`.
*   **Isolamento de Mercado:** Refatorar `executeMarketAnalysisForUser` no `scheduler.ts` para operar no nível da fazenda, garantindo que os alertas gerados sejam específicos para as culturas daquela propriedade.

## 30. O que precisa validar

*   **Fluxo de Novo Usuário:** Validar se o bootstrap (criação da fazenda padrão, settings e crops) ocorre perfeitamente no primeiro login via OAuth.
*   **Filtro de Mercado:** Confirmar se a interseção entre as notícias analisadas pelo LLM e as `monitoredCrops` está funcionando corretamente na prática.

## 31. O que precisa testar

*   **Testes de Integração:** Testar o fluxo completo do `scheduler` (mockando APIs externas) para garantir que o boletim do Telegram é gerado e enviado corretamente.
*   **Testes de Isolamento:** Garantir que um usuário não consegue acessar dados (clima, settings, crops) de uma fazenda que não lhe pertence.

## 32. O que precisa documentar

*   **Guia de Implantação:** Instruções claras sobre como configurar as variáveis de ambiente (OpenWeather, Telegram, LLM) e rodar as migrations do banco de dados em um ambiente limpo.
*   **Manual do Usuário:** Como configurar o bot do Telegram e ajustar os limites climáticos.

## 33. Melhorias Futuras

*   **Integração com Estações Locais:** Permitir a ingestão de dados de estações meteorológicas da própria fazenda via API.
*   **Módulo de Insumos:** Expandir o monitoramento de mercado para incluir preços de fertilizantes e defensivos.
*   **Gestão de Maquinário:** Integrar a janela de aplicação com a disponibilidade de pulverizadores.

## 34. Prioridades Reais

1.  **Estabilização Definitiva:** Garantir que não há nenhum resquício de código usuário-cêntrico nas operações de dados.
2.  **UI Multi-Fazenda:** Implementar a interface para o usuário criar, editar e alternar entre suas fazendas.
3.  **Limpeza de Código:** Remover o `cronJobs.ts` legado.

## 35. Sugestão da Fase 6

**Fase 6 — Expansão de Dados e UI Multi-Fazenda**
*   **Objetivo:** Consolidar a experiência do usuário com múltiplas propriedades e enriquecer os dados históricos.
*   **Tarefas:**
    *   Desenvolver telas de CRUD para Fazendas e Culturas (`crops`).
    *   Implementar gráficos de histórico de Delta T e score operacional no Dashboard.
    *   Refatorar o job de mercado para ser estritamente por fazenda.

## 36. Sugestão de Roadmap

*   **Fase 6:** UI Multi-Fazenda e Histórico Agronômico.
*   **Fase 7:** Integração de Preços de Commodities (APIs financeiras em tempo real).
*   **Fase 8:** Módulo de Colaboração (RBAC para gerentes e consultores).
*   **Fase 9:** Alertas Preditivos (IA analisando tendências climáticas de longo prazo).

## 37. Sugestão de Escalabilidade SaaS

*   **Filas de Mensageria:** Substituir o `setInterval` do `scheduler` por um sistema robusto de filas (ex: Redis/BullMQ) para gerenciar milhares de fazendas sem gargalos.
*   **Deduplicação de IA:** Analisar cada notícia de mercado apenas uma vez globalmente, e então distribuir o alerta gerado para as fazendas que monitoram as culturas afetadas, reduzindo custos de LLM.

## 38. Sugestão de IA Futura

*   **Consultor Agronômico Virtual:** Um chatbot integrado ao sistema (ou via Telegram) onde o produtor pode fazer perguntas em linguagem natural sobre seus dados climáticos históricos e receber recomendações baseadas no catálogo de culturas.

## 39. Sugestão de Integração Futura

*   **Satélites/NDVI:** Integração com APIs de imagens de satélite para monitorar o vigor vegetativo das culturas e cruzar com os dados climáticos.
*   **ERPs Agrícolas:** Exportar os dados de janelas de aplicação para softwares de gestão de fazendas (ex: Aegro, Strider).

## 40. Sugestão de Refinamento Agronômico

Os dados atuais no `CROP_CATALOG` são boas aproximações, mas requerem refinamento para a realidade específica de cada talhão:

*   **Produtividade:** A média de soja configurada é de 58 sc/ha. Dados reais da região de Canarana indicam médias de ~64 sc/ha, com fazendas de alta tecnologia superando 60 sc/ha. O milho safrinha está configurado com 120 sc/ha, alinhado com a média regional (100-110 sc/ha). O gergelim está com 25 sc/ha, o que equivale a ~1500 kg/ha, um valor muito otimista (a média real é ~500 kg/ha, chegando a 800 kg/ha em áreas excelentes).
*   **Ação:** Estes valores devem ser ajustados no catálogo padrão ou permitir que o produtor calibre sua expectativa de produtividade na interface de edição da cultura, para que análises financeiras futuras sejam precisas.
