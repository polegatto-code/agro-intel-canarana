# Infrastructure State - AgroIntel Canarana

**Última Atualização:** 11 de maio de 2026  
**Status:** ✅ Pronto para Produção

## Docker & Containerização

### Dockerfile (Multi-stage)

O projeto utiliza um Dockerfile multi-stage que otimiza o tamanho da imagem final.

**Estágios:**
1. **Builder:** Node.js 22 com pnpm, compila TypeScript e React
2. **Runtime:** Node.js 22 slim, apenas dependências de produção

**Build:**
```bash
docker build -t agro-intel-canarana:latest .
```

**Tamanho da Imagem:** ~500MB (otimizado)

---

### docker-compose.yml

Orquestra os serviços localmente: aplicação, banco de dados, Prometheus (opcional).

**Serviços:**
- **app:** Aplicação Express + React (porta 3000)
- **db:** MySQL 8.0 (porta 3306)
- **prometheus:** Prometheus (porta 9090, opcional)

**Volumes:**
- `db_data`: Persistência do MySQL
- `.env`: Variáveis de ambiente

**Rede:** `agro-intel-network` (bridge)

**Iniciar:**
```bash
docker-compose up -d
```

**Parar:**
```bash
docker-compose down
```

**Logs:**
```bash
docker-compose logs -f app
docker-compose logs -f db
```

---

## Variáveis de Ambiente

### Arquivo .env

Todas as variáveis críticas devem estar em `.env` (não commitado no git).

```bash
# ===== DATABASE =====
DATABASE_URL=mysql://root:password@db:3306/agro_intel

# ===== AUTHENTICATION =====
JWT_SECRET=seu-secret-muito-seguro-aqui
VITE_APP_ID=seu-manus-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# ===== TELEGRAM =====
TELEGRAM_BOT_TOKEN=seu-token-bot-telegram
TELEGRAM_CHAT_ID=seu-chat-id-telegram

# ===== OPENWEATHERMAP =====
OPENWEATHER_API_KEY=sua-api-key-openweather

# ===== MANUS APIs =====
BUILT_IN_FORGE_API_KEY=sua-api-key-manus
BUILT_IN_FORGE_API_URL=https://api.manus.im

# ===== APPLICATION =====
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# ===== OWNER INFO =====
OWNER_NAME=José Carvalho
OWNER_OPEN_ID=seu-open-id
```

### Validação de Variáveis

```bash
# Verificar se todas as variáveis estão definidas
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL ? '✓' : '✗ DATABASE_URL')"
```

---

## Prometheus & Monitoring

### Configuração Prometheus

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'agro-intel'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Métricas Coletadas

- `http_requests_total` - Total de requisições HTTP
- `http_request_duration_seconds` - Duração de requisições
- `system_memory_bytes` - Uso de memória
- `system_cpu_usage` - Uso de CPU
- `telegram_queue_size` - Tamanho da fila Telegram
- `cache_hit_ratio` - Taxa de acerto de cache
- `database_query_duration_seconds` - Duração de queries

### Acessar Prometheus

```
http://localhost:9090
```

### Queries Úteis

```promql
# Taxa de erro
rate(http_requests_total{status=~"5.."}[5m])

# Latência P95
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Memória do sistema
system_memory_bytes / 1024 / 1024

# Fila Telegram
telegram_queue_size
```

---

## Grafana (Opcional)

### Instalação

```bash
docker run -d -p 3001:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  grafana/grafana:latest
```

### Configuração

1. Acessar http://localhost:3001
2. Login: admin / admin
3. Adicionar data source: Prometheus (http://localhost:9090)
4. Importar dashboard: ID 1860 (Node Exporter)

---

## Startup Sequence

### Inicialização Local

```bash
# 1. Verificar dependências
node --version  # v22.13.0+
docker --version
docker-compose --version

# 2. Configurar variáveis
cp .env.example .env
# Editar .env com suas credenciais

# 3. Iniciar banco
docker-compose up -d db
sleep 10  # Aguardar banco estar pronto

# 4. Executar migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# 5. Seed de dados (opcional)
pnpm node scripts/seed-defaults.mjs

# 6. Iniciar aplicação
pnpm dev

# 7. Validar saúde
curl http://localhost:3000/health

# 8. Acessar
open http://localhost:3000
```

### Script de Startup Automático

```bash
#!/bin/bash
# scripts/startup.sh

set -e

echo "🚀 Iniciando AgroIntel Canarana..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar dependências
echo -e "${YELLOW}✓ Verificando dependências...${NC}"
node --version || { echo "Node.js não encontrado"; exit 1; }
docker --version || { echo "Docker não encontrado"; exit 1; }
docker-compose --version || { echo "docker-compose não encontrado"; exit 1; }

# Verificar .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}✓ Criando .env...${NC}"
    cp .env.example .env
    echo "⚠️  Edite .env com suas credenciais"
    exit 1
fi

# Iniciar banco
echo -e "${YELLOW}✓ Iniciando banco de dados...${NC}"
docker-compose up -d db
sleep 10

# Migrations
echo -e "${YELLOW}✓ Executando migrations...${NC}"
pnpm drizzle-kit migrate

# Instalar dependências
echo -e "${YELLOW}✓ Instalando dependências...${NC}"
pnpm install

# Iniciar app
echo -e "${GREEN}✅ Sistema pronto em http://localhost:3000${NC}"
pnpm dev
```

---

## Graceful Shutdown

### Implementação

```typescript
// server/_core/index.ts

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // 1. Parar de aceitar novas conexões
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // 2. Finalizar jobs em execução
  await cronJobService.stop();
  
  // 3. Fechar conexão com banco
  await getDb()?.close?.();
  
  // 4. Aguardar fila Telegram esvaziar
  await telegramService.flushQueue();
  
  // 5. Sair
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  // Mesmo processo acima
});
```

### Docker Graceful Shutdown

```dockerfile
# Dockerfile
STOPSIGNAL SIGTERM

# Aguarda até 30 segundos antes de forçar kill
# docker stop --time=30 container_id
```

---

## Restart Seguro

### Procedimento

```bash
# 1. Verificar status
docker-compose ps

# 2. Parar aplicação (graceful)
docker-compose stop app --time=30

# 3. Aguardar fila esvaziar (verificar logs)
docker-compose logs app | grep "Queue flushed"

# 4. Reiniciar
docker-compose up -d app

# 5. Validar saúde
curl http://localhost:3000/health
```

### Health Check no Docker

```yaml
# docker-compose.yml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## Produção (Cloud)

### Deployment em Railway/Render

1. **Conectar repositório Git**
2. **Configurar variáveis de ambiente** (via painel)
3. **Build command:** `pnpm build`
4. **Start command:** `pnpm start`
5. **Porta:** 3000

### Deployment em Kubernetes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agro-intel
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agro-intel
  template:
    metadata:
      labels:
        app: agro-intel
    spec:
      containers:
      - name: agro-intel
        image: agro-intel-canarana:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: agro-intel-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

## Backup & Disaster Recovery

### Backup Automático

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco
echo "Backing up database..."
docker-compose exec -T db mysqldump -u root -p$MYSQL_ROOT_PASSWORD agro_intel \
  > $BACKUP_DIR/db_$TIMESTAMP.sql

# Backup do código
echo "Backing up code..."
tar -czf $BACKUP_DIR/code_$TIMESTAMP.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  .

# Backup de migrations
echo "Backing up migrations..."
cp -r drizzle $BACKUP_DIR/migrations_$TIMESTAMP

echo "✅ Backup concluído: $BACKUP_DIR"

# Limpeza de backups antigos (manter últimos 7)
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
```

### Restore

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Uso: ./restore.sh <backup_file.sql>"
    exit 1
fi

echo "Restaurando de $BACKUP_FILE..."

# Parar aplicação
docker-compose stop app

# Restaurar banco
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD agro_intel < $BACKUP_FILE

# Reiniciar
docker-compose up -d app

echo "✅ Restore concluído"
```

---

## Troubleshooting

### Banco não conecta

```bash
# Verificar status
docker-compose ps db

# Verificar logs
docker-compose logs db

# Testar conexão
docker-compose exec db mysql -u root -p -e "SELECT 1;"

# Reiniciar
docker-compose restart db
```

### Aplicação não inicia

```bash
# Verificar logs
docker-compose logs app

# Verificar porta
lsof -i :3000

# Verificar variáveis
docker-compose exec app env | grep DATABASE_URL

# Rebuild
docker-compose up -d --build app
```

### Memória alta

```bash
# Verificar uso
docker stats agro-intel-canarana_app_1

# Limpar cache
curl -X POST http://localhost:3000/api/trpc/system.clearCache

# Reiniciar
docker-compose restart app
```

---

## Monitoramento Contínuo

### Alertas Recomendados

| Alerta | Condição | Ação |
|---|---|---|
| Aplicação Down | /health retorna erro | Reiniciar |
| Memória Alta | > 80% | Investigar leak |
| Fila Telegram | > 100 mensagens | Investigar Telegram API |
| Taxa Erro | > 5% | Investigar logs |
| Banco Lento | Query > 5s | Otimizar query |

### Scripts de Monitoramento

```bash
#!/bin/bash
# scripts/monitor.sh

while true; do
    # Health check
    STATUS=$(curl -s http://localhost:3000/health | jq -r '.status')
    
    if [ "$STATUS" != "healthy" ]; then
        echo "⚠️  Sistema não saudável: $STATUS"
        # Enviar alerta
    fi
    
    # Memória
    MEMORY=$(docker stats --no-stream agro-intel-canarana_app_1 | tail -1 | awk '{print $7}')
    echo "Memória: $MEMORY"
    
    sleep 60
done
```

---

**Última Sincronização:** 11 de maio de 2026  
**Status:** ✅ Infraestrutura Pronta para Produção
