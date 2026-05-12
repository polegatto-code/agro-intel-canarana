# Arquitetura Técnica — AgroIntel Canarana

## Visão Geral
O AgroIntel Canarana é uma plataforma multi-tenant (multi-fazenda) para inteligência agrícola, construída com foco em escalabilidade e baixo consumo de recursos.

## Stack Tecnológica
- **Frontend**: React + Vite + TailwindCSS + Lucide React
- **Backend**: Node.js + Express + tRPC
- **Banco de Dados**: MySQL/TiDB via Drizzle ORM
- **Autenticação**: Manus OAuth
- **Integrações**: OpenWeatherMap API, Telegram Bot API

## Estrutura Multi-Fazenda
O sistema utiliza isolamento lógico via `farmId`.
- **Usuário**: Pode possuir ou gerenciar múltiplas fazendas.
- **Fazenda**: Entidade central. Possui coordenadas, cultura principal e configurações específicas.
- **Settings**: Vinculadas ao par `(userId, farmId)`.
- **Logs/Alertas**: Sempre vinculados a um `farmId`.

## Fluxos Principais
1. **Bootstrap**: No primeiro login, o sistema cria uma fazenda padrão e configurações iniciais.
2. **Clima**: O `scheduler` busca dados do OpenWeather usando as coordenadas da fazenda e salva em `weather_logs`.
3. **Mercado**: O `newsCollector` busca notícias, a IA analisa o impacto para as culturas da fazenda e gera alertas.
4. **Notificações**: Alertas críticos são enviados via Telegram usando o token configurado para a fazenda/usuário.

## Regras de Engenharia
- **Isolamento**: Nenhuma query operacional deve omitir o filtro por `farmId`.
- **Logs**: Devem incluir `farmId` para depuração em contexto multi-tenant.
- **Frontend**: Deve usar o hook `useFarms` para determinar o contexto ativo.
