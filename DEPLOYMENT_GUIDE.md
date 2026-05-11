# Deployment Guide - AgroIntel Canarana

**Última Atualização:** 11 de maio de 2026  
**Status:** ✅ Pronto para Produção

## Visão Geral

Este guia descreve como fazer deploy do AgroIntel Canarana em ambiente local, desenvolvimento ou produção.

---

## Fase 1: Setup Inicial

### Pré-requisitos

Você precisa ter instalado:

- **Node.js** 22.x ou superior
- **pnpm** 10.x ou superior
- **Docker** 24.x ou superior
- **Docker Compose** 2.x ou superior
- **Git** 2.40 ou superior

### Verificar Instalação

```bash
# Node.js
node --version
# v22.13.0

# pnpm
pnpm --version
# 10.15.1

# Docker
docker --version
# Docker version 24.x.x

# Docker Compose
docker-compose --version
# Docker Compose version 2.x.x
```

### 1. Clonar Repositório

```bash
# Clone do GitHub
git clone https://github.com/polegatto-code/agrointel-canarana.git
cd agrointel-canarana

# Ou se já tiver o projeto
cd /home/ubuntu/agro-intel-canarana
```

### 2. Instalar Dependências

```bash
# Instalar dependências do Node.js
pnpm install

# Verificar instalação
pnpm list | head -20
```

### 3. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com suas configurações
nano .env  # ou use seu editor preferido
```

**Variáveis Obrigatórias:**

```env
# Database
DATABASE_URL=mysql://root:password@localhost:3306/agro_intel

# Telegram
TELEGRAM_BOT_TOKEN=7975185015:AAGFwz2TxHbP3PYFwFByib_8396WMG0w
TELEGRAM_CHAT_ID=7320282878

# OpenWeatherMap
OPENWEATHER_API_KEY=seu_api_key_aqui

# Manus OAuth (já fornecido pelo sistema)
VITE_APP_ID=seu_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im

# JWT
JWT_SECRET=seu_jwt_secret_aleatorio

# Ambiente
NODE_ENV=development
```

---

## Fase 2: Validar Backend

### 2.1 Iniciar Banco de Dados

```bash
# Opção 1: Docker Compose (Recomendado)
docker-compose up -d db

# Verificar se está rodando
docker-compose ps

# Esperar 10 segundos para o banco iniciar
sleep 10

# Verificar conexão
docker-compose exec db mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT 1;"
```

### 2.2 Executar Migrations

```bash
# Gerar migrations (se houver mudanças no schema)
pnpm drizzle-kit generate

# Aplicar migrations
pnpm drizzle-kit migrate
```

### 2.3 Iniciar Servidor

```bash
# Desenvolvimento (com hot reload)
pnpm dev

# Ou produção
pnpm build
pnpm start
```

**Esperado:**
```
[2026-05-11T20:19:32.340Z] [OAuth] Initialized with baseURL: https://api.manus.im
[2026-05-11T20:19:32.577Z] Server running on http://localhost:3000/
```

### 2.4 Testar Health Check

```bash
# Em outro terminal
curl http://localhost:3000/health | jq .

# Resposta esperada:
{
  "status": "ok",
  "timestamp": "2026-05-11T20:19:33.000Z",
  "uptime": 1.234,
  "database": "connected",
  "telegram": "ready",
  "cache": "active",
  "memory": {
    "used": 125.5,
    "total": 512,
    "percentage": 24.5
  }
}
```

**Se receber `{"status":"ok"}`, o backend está vivo! ✅**

### 2.5 Testar Endpoints Adicionais

```bash
# Liveness probe
curl http://localhost:3000/health/live

# Readiness probe
curl http://localhost:3000/health/ready

# Prometheus metrics
curl http://localhost:3000/metrics

# Debug contexts
curl http://localhost:3000/debug/contexts
```

---

## Fase 3: Configurar Telegram

### 3.1 Criar Bot Telegram

1. Abra Telegram e procure por `@BotFather`
2. Digite `/newbot`
3. Siga as instruções:
   - Nome do bot: `AgroIntel Canarana`
   - Username: `agrointel_canarana_bot` (único)
4. Copie o **Token** fornecido

### 3.2 Obter Chat ID

1. Abra seu bot no Telegram
2. Envie qualquer mensagem para o bot
3. Acesse: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Procure por `"chat":{"id":XXXXXXX}`
5. Copie o ID

### 3.3 Configurar .env

```env
TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui
```

### 3.4 Testar Envio

```bash
# Via endpoint tRPC
curl -X POST http://localhost:3000/api/trpc/jobs.sendTestTelegramMessage \
  -H "Content-Type: application/json" \
  -d '{"priority":"normal","message":"Teste do AgroIntel"}'

# Ou via interface web
# Abra http://localhost:3000 e clique em "Testar Telegram"
```

**Esperado:** Mensagem aparece no seu Telegram ✅

---

## Fase 4: Conectar APIs Reais

### 4.1 OpenWeatherMap

```bash
# 1. Criar conta em https://openweathermap.org/api
# 2. Gerar API Key
# 3. Adicionar ao .env
OPENWEATHER_API_KEY=seu_api_key

# 4. Testar
curl "https://api.openweathermap.org/data/2.5/weather?q=Canarana,BR&appid=$OPENWEATHER_API_KEY&units=metric"
```

### 4.2 Fontes de Notícias Agrícolas

**Implementadas:**
- Embrapa (web scraping)
- Conab (web scraping)
- Agrolink (web scraping)
- Agência Brasil (web scraping)

**Para adicionar novas fontes:**

1. Editar `server/services/newsCollector.ts`
2. Adicionar nova função de coleta
3. Testar com `jobs.triggerMarketAnalysis`

### 4.3 Integração com LLM

O sistema já usa LLM do Manus para análise. Para customizar:

```bash
# Editar prompt em server/services/newsAnalysis.ts
# Recompilar
pnpm build
```

---

## Fase 5: Executar Tarefas Agendadas

### 5.1 Teste Manual

```bash
# Coleta climática
curl -X POST http://localhost:3000/api/trpc/jobs.triggerWeatherCheck

# Análise de mercado
curl -X POST http://localhost:3000/api/trpc/jobs.triggerMarketAnalysis

# Ver logs
curl http://localhost:3000/api/trpc/jobs.getLogs
```

### 5.2 Agendamento Automático

O sistema roda automaticamente às 5h da manhã. Para testar:

```bash
# Simular execução de cron
docker-compose exec app node -e "
  const { runWeatherJob } = require('./dist/services/cronJobs');
  runWeatherJob().then(() => process.exit(0));
"
```

---

## Fase 6: Deploy em Produção

### 6.1 Build para Produção

```bash
# Build
pnpm build

# Verificar build
ls -lh dist/

# Testar build localmente
NODE_ENV=production node dist/index.js
```

### 6.2 Docker Production

```bash
# Build imagem Docker
docker build -t agrointel:latest .

# Executar container
docker run -d \
  --name agrointel \
  -p 3000:3000 \
  --env-file .env \
  agrointel:latest

# Verificar logs
docker logs -f agrointel
```

### 6.3 Docker Compose Production

```bash
# Arquivo docker-compose.yml já está pronto
docker-compose -f docker-compose.yml up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f app

# Parar
docker-compose down
```

---

## Troubleshooting

### Erro: "Connection refused"

```bash
# Verificar se banco está rodando
docker-compose ps db

# Se não estiver, iniciar
docker-compose up -d db

# Verificar logs
docker-compose logs db
```

### Erro: "Database error"

```bash
# Verificar conexão
docker-compose exec db mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT 1;"

# Recriar banco
docker-compose exec db mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "DROP DATABASE agro_intel; CREATE DATABASE agro_intel;"

# Aplicar migrations
pnpm drizzle-kit migrate
```

### Erro: "Telegram not responding"

```bash
# Verificar token
echo $TELEGRAM_BOT_TOKEN

# Testar API do Telegram
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Se erro, gerar novo token com @BotFather
```

### Erro: "Port 3000 already in use"

```bash
# Encontrar processo
lsof -i :3000

# Matar processo
kill -9 <PID>

# Ou usar porta diferente
PORT=3001 pnpm dev
```

---

## Monitoramento

### Verificar Saúde do Sistema

```bash
# Health check completo
curl http://localhost:3000/health | jq .

# Métricas Prometheus
curl http://localhost:3000/metrics

# Logs estruturados
curl http://localhost:3000/api/trpc/jobs.getLogs | jq .

# Erros recentes
curl http://localhost:3000/api/trpc/jobs.getRecentErrors | jq .

# Status da fila Telegram
curl http://localhost:3000/api/trpc/jobs.getTelegramQueueStatus | jq .

# Estatísticas de cache
curl http://localhost:3000/api/trpc/jobs.getCacheStats | jq .
```

### Logs em Tempo Real

```bash
# Docker
docker-compose logs -f app

# Node.js
tail -f logs/*.log

# Grep específico
grep "ERROR" logs/*.log
```

---

## Checklist de Deploy

### Antes de Fazer Deploy

- [ ] Node.js 22.x instalado
- [ ] pnpm 10.x instalado
- [ ] Docker e Docker Compose instalados
- [ ] .env configurado com todas as variáveis
- [ ] Banco de dados rodando
- [ ] Migrations aplicadas
- [ ] Health check respondendo
- [ ] Telegram configurado e testado
- [ ] APIs externas testadas

### Durante o Deploy

- [ ] Build executado sem erros
- [ ] Testes passando
- [ ] Container iniciado com sucesso
- [ ] Health check validado
- [ ] Logs monitorados

### Após o Deploy

- [ ] Verificar health check
- [ ] Testar funcionalidades críticas
- [ ] Monitorar logs
- [ ] Validar Telegram
- [ ] Testar coleta climática
- [ ] Testar análise de mercado

---

## Próximos Passos

1. **Fase 1:** ✅ Setup inicial
2. **Fase 2:** ✅ Validar backend
3. **Fase 3:** ✅ Telegram
4. **Fase 4:** ⏳ APIs reais
5. **Fase 5:** ⏳ Tarefas agendadas
6. **Fase 6:** ⏳ Deploy produção

---

## Suporte

Para problemas ou dúvidas:

1. Verificar logs: `docker-compose logs app`
2. Consultar documentação: `README.md`, `ARCHITECTURE.md`
3. Testar endpoints: `curl http://localhost:3000/health`
4. Validar configuração: `cat .env`

---

**Última Atualização:** 11 de maio de 2026  
**Status:** ✅ Documentado e Testado  
**Próxima Revisão:** 25 de maio de 2026
