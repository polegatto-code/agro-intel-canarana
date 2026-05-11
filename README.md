# AgroIntel Canarana

**Plataforma de Inteligência Agrícola para Otimização de Aplicação de Defensivos e Monitoramento de Mercado**

## Objetivo do Sistema

O AgroIntel Canarana é uma plataforma web de apoio à decisão agrícola desenvolvida especificamente para produtores do Vale do Araguaia em Canarana-MT. O sistema fornece inteligência operacional em tempo real para otimizar a aplicação de defensivos e insumos, além de monitorar tendências de mercado que impactam o custo das lavouras de soja, milho, mileto, sorgo e gergelim.

### Funcionalidades Principais

**Monitoramento Climático Automático:** O sistema coleta dados climáticos de Canarana-MT diariamente às 5h da manhã, analisa temperatura, umidade relativa e velocidade do vento, e classifica as condições operacionais em cinco níveis (Excelente, Boa, Moderada, Ruim, Não Recomendada). Com base nesses dados, identifica automaticamente a melhor janela de aplicação para o dia e envia notificação via Telegram.

**Análise de Riscos Operacionais:** O sistema identifica automaticamente cinco tipos de risco operacional (deriva, volatilização, lavagem, absorção, estresse térmico) e calcula um score operacional numérico (0-100) que sintetiza a qualidade das condições para aplicação.

**Inteligência de Mercado:** O sistema coleta notícias agrícolas de múltiplas fontes confiáveis, utiliza LLM para análise contextualizada, e gera boletins interpretativos que cruzam o impacto geopolítico com a realidade do produtor brasileiro. Monitora especificamente: dólar, preços de insumos (Ureia, MAP, KCL, Super Simples, Super Triplo, Nitrato de Amônio, Sulfato de Amônio, NPK formulados), conflitos geopolíticos, e logística.

**Persistência Histórica:** Todos os dados climáticos, análises de mercado, alertas e notificações são salvos no banco de dados para análise futura, comparação de tendências e histórico operacional.

## Stack Tecnológico

| Componente | Tecnologia | Versão |
|---|---|---|
| **Frontend** | React 19 + Tailwind CSS 4 | 19.2.1 / 4.1.14 |
| **Backend** | Express.js + tRPC | 4.21.2 / 11.6.0 |
| **Banco de Dados** | MySQL/TiDB | - |
| **ORM** | Drizzle ORM | 0.44.5 |
| **Autenticação** | Manus OAuth | - |
| **Testes** | Vitest | 2.1.4 |
| **Containerização** | Docker + docker-compose | - |
| **Monitoramento** | Prometheus | - |
| **Node.js** | v22.13.0 | - |

## Arquitetura do Sistema

### Visão Geral

O AgroIntel Canarana segue uma arquitetura de três camadas: apresentação (React), aplicação (Express + tRPC) e persistência (MySQL). O sistema é preparado para multi-tenant, com isolamento de dados por usuário/fazenda.

### Componentes Principais

**Frontend (React + Tailwind):** Interface elegante e responsiva com dashboard principal exibindo clima, janela de aplicação, alertas de mercado e histórico. Componentes reutilizáveis com shadcn/ui para consistência visual.

**Backend (Express + tRPC):** API type-safe com procedimentos tRPC para clima, configurações, alertas e mercado. Integração com OpenWeatherMap para coleta climática, LLM para análise de notícias, e Telegram para notificações.

**Serviços de Automação:** Cron jobs para execução automática às 5h, coleta de notícias, análise com LLM, envio Telegram com sistema de prioridades, deduplicação de alertas e cache inteligente.

**Observabilidade:** Health endpoints HTTP (/health, /live, /ready, /metrics), Prometheus metrics, correlation IDs em logs estruturados, circuit breaker para APIs externas, retry exponencial com fallback.

### Fluxo de Dados

```
1. Coleta Climática (5h)
   ↓
2. Análise Operacional + Score
   ↓
3. Identificação de Riscos
   ↓
4. Cálculo de Janela de Aplicação
   ↓
5. Persistência no Banco
   ↓
6. Envio Telegram com Prioridade
   ↓
7. Deduplicação + Cache

1. Coleta de Notícias (Diária/Semanal)
   ↓
2. Análise com LLM
   ↓
3. Interpretação de Cenário
   ↓
4. Persistência no Banco
   ↓
5. Envio Boletim Telegram
```

## Como Iniciar

### Pré-requisitos

- Node.js v22.13.0 ou superior
- Docker e docker-compose
- MySQL 8.0+ (ou use docker-compose)
- Token de Bot Telegram
- Chat ID do Telegram
- Variáveis de ambiente configuradas

### Instalação Local

```bash
# Clonar repositório
git clone <repo-url>
cd agro-intel-canarana

# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Executar migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Iniciar servidor de desenvolvimento
pnpm dev

# Acessar em http://localhost:3000
```

### Iniciar com Docker

```bash
# Construir imagem
docker build -t agro-intel-canarana .

# Executar com docker-compose
docker-compose up -d

# Verificar logs
docker-compose logs -f app

# Acessar em http://localhost:3000
```

## Como Restaurar

### Restaurar de Checkpoint

O projeto utiliza checkpoints versionados que podem ser restaurados em caso de problemas:

```bash
# Listar checkpoints disponíveis
git log --oneline

# Restaurar para checkpoint específico
git checkout <commit-hash>

# Ou usar rollback do Manus
webdev_rollback_checkpoint <version_id>
```

### Restaurar Banco de Dados

```bash
# Backup atual
mysqldump -u root -p agro_intel > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar de backup
mysql -u root -p agro_intel < backup_20260511_120000.sql

# Recriar schema do zero
pnpm drizzle-kit push
```

## Como Executar

### Modo Desenvolvimento

```bash
# Terminal 1: Servidor
pnpm dev

# Terminal 2: Testes
pnpm test

# Terminal 3: Monitorar banco
docker-compose logs -f db
```

### Modo Produção

```bash
# Build
pnpm build

# Iniciar
pnpm start

# Com Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Executar Testes

```bash
# Todos os testes
pnpm test

# Testes específicos
pnpm test server/integration.test.ts
pnpm test server/health.test.ts

# Com cobertura
pnpm test -- --coverage
```

### Executar Cron Jobs Manualmente

```bash
# Teste de clima
curl http://localhost:3000/api/trpc/jobs.triggerWeatherCheck

# Teste de mercado
curl http://localhost:3000/api/trpc/jobs.triggerMarketAnalysis

# Teste de Telegram
curl http://localhost:3000/api/trpc/jobs.sendTestTelegramMessage
```

## Como Subir Ambiente Completo

### Startup Sequence Automática

```bash
# 1. Iniciar banco de dados
docker-compose up -d db

# 2. Aguardar banco estar pronto
sleep 10

# 3. Executar migrations
pnpm drizzle-kit migrate

# 4. Seed de dados padrão (opcional)
pnpm node scripts/seed-defaults.mjs

# 5. Iniciar aplicação
pnpm dev

# 6. Validar healthcheck
curl http://localhost:3000/health

# 7. Validar Prometheus
curl http://localhost:3000/metrics
```

### Script de Inicialização Rápida

```bash
#!/bin/bash
# scripts/startup.sh

set -e

echo "🚀 Iniciando AgroIntel Canarana..."

# Verificar dependências
echo "✓ Verificando Node.js..."
node --version

echo "✓ Verificando Docker..."
docker --version

# Iniciar banco
echo "✓ Iniciando banco de dados..."
docker-compose up -d db
sleep 10

# Migrations
echo "✓ Executando migrations..."
pnpm drizzle-kit migrate

# Iniciar app
echo "✓ Iniciando aplicação..."
pnpm dev

echo "✅ Sistema pronto em http://localhost:3000"
```

## Estrutura do Projeto

```
agro-intel-canarana/
├── client/                          # Frontend React
│   ├── src/
│   │   ├── pages/                   # Páginas da aplicação
│   │   ├── components/              # Componentes reutilizáveis
│   │   ├── hooks/                   # Custom hooks
│   │   ├── lib/                     # Utilitários
│   │   └── App.tsx                  # Roteamento principal
│   └── public/                      # Assets estáticos
├── server/                          # Backend Express + tRPC
│   ├── services/                    # Serviços de negócio
│   │   ├── weather.ts               # Coleta climática
│   │   ├── newsCollector.ts         # Coleta de notícias
│   │   ├── newsAnalysis.ts          # Análise com LLM
│   │   ├── telegram.ts              # Envio de notificações
│   │   ├── scheduler.ts             # Orquestração de jobs
│   │   ├── metrics.ts               # Observabilidade
│   │   ├── healthcheck.ts           # Health checks
│   │   ├── circuitBreaker.ts        # Resiliência
│   │   ├── retry.ts                 # Retry automático
│   │   └── logger.ts                # Logging centralizado
│   ├── routers/                     # Procedimentos tRPC
│   ├── routes/                      # Rotas HTTP
│   ├── db.ts                        # Query helpers
│   ├── routers.ts                   # Definição de routers
│   └── _core/                       # Framework plumbing
├── drizzle/                         # Schema e migrations
│   ├── schema.ts                    # Definição de tabelas
│   └── *.sql                        # Migrations geradas
├── Dockerfile                       # Containerização
├── docker-compose.yml               # Orquestração local
├── .env.example                     # Variáveis de ambiente
├── ARCHITECTURE.md                  # Documentação técnica
├── PROJECT_STATE.md                 # Estado atual do projeto
├── DATABASE_STATE.md                # Estado do banco de dados
├── API_STATE.md                     # Documentação de APIs
├── INFRA_STATE.md                   # Estado da infraestrutura
├── TODO_MASTER.md                   # Tarefas e roadmap
├── CHANGELOG.md                     # Histórico de mudanças
└── BACKUP_RESTORE.md                # Guia de backup/restore
```

## Endpoints Principais

### Health & Monitoring

- `GET /health` - Health check completo
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

### tRPC Procedures

- `jobs.triggerWeatherCheck` - Disparo manual de coleta climática
- `jobs.triggerMarketAnalysis` - Disparo manual de análise de mercado
- `jobs.sendTestTelegramMessage` - Teste de envio Telegram
- `jobs.getLogs` - Visualizar logs do sistema
- `jobs.healthCheck` - Verificação de saúde completa

## Variáveis de Ambiente

```bash
# Banco de Dados
DATABASE_URL=mysql://user:password@localhost:3306/agro_intel

# Autenticação
JWT_SECRET=seu-secret-aqui
VITE_APP_ID=seu-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# Telegram
TELEGRAM_BOT_TOKEN=seu-token-aqui
TELEGRAM_CHAT_ID=seu-chat-id-aqui

# OpenWeatherMap
OPENWEATHER_API_KEY=sua-api-key-aqui

# LLM (Manus)
BUILT_IN_FORGE_API_KEY=sua-api-key-aqui
BUILT_IN_FORGE_API_URL=https://api.manus.im

# Ambiente
NODE_ENV=development
PORT=3000
```

## Troubleshooting

### Banco de Dados Não Conecta

```bash
# Verificar status do container
docker-compose ps

# Verificar logs
docker-compose logs db

# Reiniciar banco
docker-compose restart db

# Verificar conexão
mysql -h localhost -u root -p -e "SELECT 1;"
```

### Migrations Falhando

```bash
# Verificar migrations aplicadas
SELECT * FROM __drizzle_migrations;

# Recriar schema
pnpm drizzle-kit drop
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Telegram Não Envia

```bash
# Testar token
curl -X POST https://api.telegram.org/bot<TOKEN>/getMe

# Testar envio manual
curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage \
  -d "chat_id=<CHAT_ID>&text=Teste"

# Verificar logs
pnpm test server/health.test.ts
```

## Suporte e Documentação

Para informações detalhadas sobre cada componente, consulte:

- **ARCHITECTURE.md** - Arquitetura técnica completa
- **DATABASE_STATE.md** - Schema e migrations
- **API_STATE.md** - Documentação de endpoints
- **INFRA_STATE.md** - Infraestrutura e deploy
- **PROJECT_STATE.md** - Estado atual e roadmap
- **BACKUP_RESTORE.md** - Procedimentos de backup/restore

## Licença

Propriedade do produtor rural de Canarana-MT.

---

**Última atualização:** 11 de maio de 2026  
**Versão:** 1.0.0  
**Status:** Pronto para Produção
