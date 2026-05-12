# DÍVIDA TÉCNICA — AgroIntel Canarana

**Autor:** Manus AI
**Última atualização:** 12 de maio de 2026

Este documento lista a dívida técnica identificada no projeto AgroIntel Canarana, com foco em itens que não foram corrigidos nesta sessão, mas que merecem atenção futura.

## Dívida Técnica Identificada

| Item | Descrição | Impacto | Prioridade | Tratamento Sugerido |
|---|---|---|---|---|
| **`cronJobs.ts`** | Código legado e obsoleto, duplicando funcionalidade do `scheduler.ts`. | Confusão na manutenção, possível execução de lógica desatualizada. | Alta | Remover completamente o arquivo e suas referências após validação de que `scheduler.ts` cobre todos os casos de uso. |
| **`getAllUsersWithSettings`** | Embora corrigido para usar `innerJoin` com `currentFarmId`, a função ainda retorna uma estrutura que pode ser confusa se um usuário tiver múltiplas fazendas e a intenção for obter *todas* as configurações de *todas* as fazendas. | Potencial para lógica de negócio complexa ou erros se a função for mal interpretada em outros módulos. | Média | Refatorar para ter uma função `getAllUserSettingsForAllFarms(userId)` e `getUserSettingsForFarm(userId, farmId)` para clareza. |
| **`scheduler.ts` - Título Telegram** | O título do boletim Telegram ainda menciona `CANARANA-MT` mesmo quando as coordenadas da fazenda são usadas. | Inconsistência na mensagem para o usuário, especialmente para fazendas fora de Canarana. | Média | Parametrizar o título do boletim com o nome da fazenda ou município da fazenda. |
| **`newsCollector.ts` - Coleta de Notícias** | A coleta de notícias ainda usa placeholders (`getRealNewsPlaceholder`) em vez de uma integração real com APIs de notícias ou RSS feeds. | Dependência de dados mockados, não reflete o cenário real de mercado. | Alta | Implementar integração real com APIs de notícias agrícolas ou RSS feeds, conforme o plano original. |
| **`marketAlerts` - Filtragem de Crops** | A filtragem de `marketAlerts` por `affectedCrops` é feita em memória (`filter().slice()`) após buscar mais alertas do que o necessário (`limit * 2`). | Ineficiência para grandes volumes de alertas, especialmente se a filtragem em memória for muito seletiva. | Média | Explorar formas de realizar a filtragem por `affectedCrops` diretamente na query SQL via Drizzle, se possível, ou otimizar a busca inicial. |
| **UI Multi-Fazenda** | A interface do usuário (Frontend) ainda não possui um seletor de fazenda ativa ou visualização completa para o contexto multi-fazenda. | Limita a usabilidade e a capacidade do usuário de gerenciar múltiplas fazendas. | Alta | Desenvolver componentes de UI para seleção de fazenda, exibição de dados por fazenda e gerenciamento de usuários por fazenda. |
| **`server/_core/index.ts` - Ativação do Scheduler** | O ponto de entrada da aplicação (`server/_core/index.ts`) não chama explicitamente `scheduler.start()`. | O scheduler pode não ser iniciado automaticamente, dependendo do ambiente de execução. | Alta | Adicionar `scheduler.start()` no bootstrap da aplicação para garantir que os jobs agendados sejam iniciados. |

## Próximos Passos para a Dívida Técnica

Recomenda-se abordar a dívida técnica de alta prioridade nas próximas fases de desenvolvimento, integrando-as ao roadmap do projeto. A remoção de código obsoleto e a implementação de integrações reais são cruciais para a estabilidade e funcionalidade do sistema.
