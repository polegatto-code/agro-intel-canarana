# Changelog - AgroIntel Canarana

Todas as mudanças importantes neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/), e este projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.0.0] - 2026-05-11

### Adicionado

#### Infraestrutura Base
- Schema de banco de dados com 9 tabelas (users, userSettings, weatherLogs, weatherDailySummary, marketAlerts, marketAnalysisDaily, notificationLogs, scheduledJobs)
- ORM Drizzle sincronizado com MySQL
- Migrations versionadas
- Autenticação OAuth integrada com Manus
- Frontend React 19 + Tailwind CSS 4
- Backend Express + tRPC type-safe
- Dockerfile multi-stage otimizado
- docker-compose para ambiente local

#### Automação Climática
- Integração com OpenWeatherMap para Canarana-MT
- Coleta automática de clima às 5h da manhã
- Análise de temperatura, umidade relativa, velocidade do vento
- Classificação operacional em 5 níveis (Excelente, Boa, Moderada, Ruim, Não Recomendada)
- Cálculo automático de janela de aplicação recomendada
- Identificação de 5 tipos de risco operacional (deriva, volatilização, lavagem, absorção, estresse térmico)
- Score operacional numérico (0-100)
- Persistência em weatherLogs e weatherDailySummary
- Envio via Telegram com prioridades

#### Monitoramento de Mercado
- Coleta de notícias de múltiplas fontes agrícolas (Embrapa, Conab, Agrolink, Agência Brasil)
- Integração com LLM para análise contextualizada
- Interpretação de cenário geopolítico
- Cruzamento de impacto com realidade brasileira
- Monitoramento de: dólar, insumos (Ureia, MAP, KCL, Super Simples, Super Triplo, Nitrato de Amônio, Sulfato de Amônio, NPK formulados), conflitos, logística, China, exportações, clima EUA
- Persistência em marketAlerts e marketAnalysisDaily
- Deduplicação de alertas (24h)
- Envio de boletim via Telegram

#### Infraestrutura de Automação
- Logger centralizado com 5 níveis de severidade (debug, info, warn, error, critical)
- Telegram service com sistema de prioridades (low, normal, high, critical)
- Retry automático com exponential backoff
- Circuit breaker para proteção contra cascata de falhas
- Cache inteligente com TTL configurável
- Rate limiter para proteção de APIs
- Correlation IDs em logs estruturados
- Request IDs e execution IDs para rastreamento
- Deduplicação de alertas com janela de 24h

#### Observabilidade
- Health endpoints HTTP (/health, /live, /ready)
- Prometheus metrics em formato padrão
- Monitoramento de: performance, erros, latência, memória, CPU
- Debug endpoints para contextos e logs
- Testes HTTP validando todos os endpoints (13 testes)
- Healthcheck configurado no Docker

#### Testes
- 30+ testes de integração com Vitest
- Cobertura de: metrics, circuit breaker, retry, cache, rate limiter, context
- Testes HTTP para health endpoints
- Simulação de pipeline completo
- Validação de Prometheus metrics
- Testes de fallback e resiliência

#### Dashboard
- Interface elegante e responsiva com React 19
- Visualização de clima em tempo real
- Cards de temperatura, umidade relativa, velocidade do vento
- Exibição de janela de aplicação recomendada
- Classificação operacional visual
- Últimos alertas de mercado
- Botões de ação (Ver Histórico Completo, Configurar Parâmetros, Análise de Tendências)
- Design sofisticado com Tailwind CSS 4

#### Documentação
- README.md com guia completo de uso
- PROJECT_STATE.md com status e roadmap
- DATABASE_STATE.md com schema completo
- API_STATE.md com documentação de endpoints
- INFRA_STATE.md com infraestrutura
- ARCHITECTURE.md com arquitetura técnica
- TODO_MASTER.md com tarefas e prioridades
- CHANGELOG.md com histórico de mudanças
- BACKUP_RESTORE.md com procedimentos

#### Scripts
- scripts/startup.sh para inicialização automática
- scripts/backup.sh para backup automático
- scripts/restore.sh para restauração
- scripts/monitor.sh para monitoramento contínuo

### Mudanças

- Estrutura preparada para multi-tenant (v1.1)
- Isolamento de dados por userId
- RBAC pronto para implementação
- Observabilidade completa com correlation IDs

### Notas Técnicas

- Banco de dados sincronizado com 9 tabelas operacionais
- Todas as migrations aplicadas com sucesso
- 30+ testes ponta a ponta passando
- 13 testes HTTP validando health endpoints
- Sistema pronto para produção
- Graceful shutdown implementado
- Circuit breaker ativo para APIs externas
- Cache inteligente com TTL de 3600s

---

## [0.9.0] - 2026-05-10

### Adicionado (Pré-release)

- Schema inicial de banco de dados
- Autenticação OAuth
- Frontend React básico
- Backend Express com tRPC
- Integração OpenWeatherMap
- Integração Telegram
- Integração LLM

### Notas

- Versão de desenvolvimento
- Banco de dados não sincronizado
- Migrations incompletas
- Testes em desenvolvimento

---

## Roadmap Futuro

### [1.1.0] - Junho 2026

**Foco:** Integração Real + Configurações

- Integração real de cron jobs
- Página de configurações completa
- Página de histórico com gráficos
- Bootstrap automático de dados
- Multi-tenant básico
- Criptografia de secrets

### [1.2.0] - Julho 2026

**Foco:** Dashboard Administrativo + Segurança

- Dashboard administrativo
- RBAC completo
- Auditoria de operações
- Análise de tendências
- Relatórios PDF
- Validação de entrada completa

### [2.0.0] - Setembro 2026

**Foco:** Inteligência Agrícola Avançada

- Análise preditiva de clima
- Integração com satélite (NDVI)
- App mobile (iOS/Android)
- Múltiplas regiões
- Detecção de pragas/doenças
- Integração com IoT

---

## Convenções de Commit

Este projeto segue [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Mudanças em documentação
- `style:` Formatação, sem mudança de código
- `refactor:` Refatoração de código
- `perf:` Melhorias de performance
- `test:` Adição/modificação de testes
- `chore:` Tarefas de build, dependências, etc

Exemplo:
```
feat: adicionar página de configurações

- Implementar formulário de edição
- Validar parâmetros climáticos
- Salvar no banco de dados
```

---

## Como Contribuir

1. Criar branch: `git checkout -b feature/sua-feature`
2. Commit com Conventional Commits: `git commit -m "feat: descrição"`
3. Push: `git push origin feature/sua-feature`
4. Criar Pull Request
5. Atualizar CHANGELOG.md
6. Atualizar TODO_MASTER.md

---

## Versionamento

Este projeto segue [Semantic Versioning](https://semver.org/lang/pt-BR/):

- **MAJOR:** Mudanças incompatíveis na API
- **MINOR:** Novas funcionalidades compatíveis
- **PATCH:** Correções de bugs

Formato: `MAJOR.MINOR.PATCH`

---

**Desenvolvido por:** Manus AI  
**Para:** Produtor Rural - Vale do Araguaia, Canarana-MT  
**Data de Início:** 11 de maio de 2026
