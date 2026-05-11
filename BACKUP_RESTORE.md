# Backup & Restore - AgroIntel Canarana

**Última Atualização:** 11 de maio de 2026  
**Status:** ✅ Documentado

## Visão Geral

Este documento descreve os procedimentos para backup, restore e recuperação de desastres do AgroIntel Canarana. O sistema foi projetado para permitir recuperação rápida em caso de falha.

---

## Backup Automático

### Script de Backup Completo

```bash
#!/bin/bash
# scripts/backup.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="agro-intel-$TIMESTAMP"

echo "🔄 Iniciando backup completo..."

# Criar diretório
mkdir -p $BACKUP_DIR

# 1. Backup do Banco de Dados
echo "📦 Backup do banco de dados..."
docker-compose exec -T db mysqldump \
  -u root \
  -p$MYSQL_ROOT_PASSWORD \
  --single-transaction \
  --quick \
  agro_intel > $BACKUP_DIR/db_$TIMESTAMP.sql

if [ $? -eq 0 ]; then
    echo "✅ Banco de dados: OK ($(du -h $BACKUP_DIR/db_$TIMESTAMP.sql | cut -f1))"
else
    echo "❌ Erro ao fazer backup do banco"
    exit 1
fi

# 2. Backup do Código
echo "📦 Backup do código..."
tar -czf $BACKUP_DIR/code_$TIMESTAMP.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  --exclude=backups \
  --exclude=.env \
  .

if [ $? -eq 0 ]; then
    echo "✅ Código: OK ($(du -h $BACKUP_DIR/code_$TIMESTAMP.tar.gz | cut -f1))"
else
    echo "❌ Erro ao fazer backup do código"
    exit 1
fi

# 3. Backup de Migrations
echo "📦 Backup de migrations..."
tar -czf $BACKUP_DIR/migrations_$TIMESTAMP.tar.gz drizzle/

if [ $? -eq 0 ]; then
    echo "✅ Migrations: OK ($(du -h $BACKUP_DIR/migrations_$TIMESTAMP.tar.gz | cut -f1))"
else
    echo "❌ Erro ao fazer backup de migrations"
    exit 1
fi

# 4. Backup de Configuração
echo "📦 Backup de configuração..."
cp .env $BACKUP_DIR/.env_$TIMESTAMP.backup
cp docker-compose.yml $BACKUP_DIR/docker-compose_$TIMESTAMP.yml

if [ $? -eq 0 ]; then
    echo "✅ Configuração: OK"
else
    echo "❌ Erro ao fazer backup de configuração"
    exit 1
fi

# 5. Criar manifesto
echo "📝 Criando manifesto..."
cat > $BACKUP_DIR/MANIFEST_$TIMESTAMP.txt << EOF
Backup Completo - AgroIntel Canarana
Data: $TIMESTAMP
Arquivos:
- db_$TIMESTAMP.sql (Banco de dados MySQL)
- code_$TIMESTAMP.tar.gz (Código-fonte)
- migrations_$TIMESTAMP.tar.gz (Migrations Drizzle)
- .env_$TIMESTAMP.backup (Variáveis de ambiente)
- docker-compose_$TIMESTAMP.yml (Configuração Docker)

Para restaurar, ver BACKUP_RESTORE.md
EOF

# 6. Limpeza de backups antigos (manter últimos 7)
echo "🧹 Limpeza de backups antigos..."
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "code_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "migrations_*.tar.gz" -mtime +7 -delete

echo "✅ Backup concluído em: $BACKUP_DIR"
echo "📊 Espaço total: $(du -sh $BACKUP_DIR | cut -f1)"
```

### Agendamento Automático

```bash
# Adicionar ao crontab para backup diário às 2h da manhã
0 2 * * * cd /home/ubuntu/agro-intel-canarana && bash scripts/backup.sh >> logs/backup.log 2>&1
```

---

## Restauração de Banco de Dados

### Restaurar de Backup SQL

```bash
#!/bin/bash
# scripts/restore-db.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Uso: ./restore-db.sh <backup_file.sql>"
    echo ""
    echo "Backups disponíveis:"
    ls -lh backups/db_*.sql
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  AVISO: Isto irá sobrescrever o banco de dados atual!"
echo "Arquivo: $BACKUP_FILE"
echo "Tamanho: $(du -h $BACKUP_FILE | cut -f1)"
read -p "Continuar? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Cancelado"
    exit 1
fi

echo "🔄 Parando aplicação..."
docker-compose stop app

echo "🔄 Restaurando banco de dados..."
docker-compose exec -T db mysql \
  -u root \
  -p$MYSQL_ROOT_PASSWORD \
  agro_intel < $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "✅ Banco restaurado com sucesso"
    
    echo "🔄 Reiniciando aplicação..."
    docker-compose up -d app
    
    sleep 5
    
    echo "🔍 Validando saúde..."
    curl -s http://localhost:3000/health | jq .
    
    echo "✅ Restauração concluída"
else
    echo "❌ Erro ao restaurar banco"
    docker-compose up -d app
    exit 1
fi
```

### Restaurar Migrations

```bash
# Extrair migrations do backup
tar -xzf backups/migrations_20260511_120000.tar.gz

# Aplicar migrations
pnpm drizzle-kit migrate
```

---

## Recuperação Completa do Sistema

### Cenário 1: Perda Total de Dados

```bash
#!/bin/bash
# scripts/full-recovery.sh

BACKUP_DIR=$1

if [ -z "$BACKUP_DIR" ]; then
    echo "Uso: ./full-recovery.sh <backup_directory>"
    exit 1
fi

echo "🚨 RECUPERAÇÃO COMPLETA DO SISTEMA"
echo "Backup: $BACKUP_DIR"
read -p "Continuar? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    exit 1
fi

# 1. Parar sistema
echo "1️⃣  Parando sistema..."
docker-compose down

# 2. Restaurar código
echo "2️⃣  Restaurando código..."
tar -xzf $BACKUP_DIR/code_*.tar.gz

# 3. Restaurar configuração
echo "3️⃣  Restaurando configuração..."
cp $BACKUP_DIR/.env_*.backup .env
cp $BACKUP_DIR/docker-compose_*.yml docker-compose.yml

# 4. Restaurar migrations
echo "4️⃣  Restaurando migrations..."
rm -rf drizzle/
tar -xzf $BACKUP_DIR/migrations_*.tar.gz

# 5. Iniciar banco
echo "5️⃣  Iniciando banco de dados..."
docker-compose up -d db
sleep 10

# 6. Restaurar banco
echo "6️⃣  Restaurando banco de dados..."
docker-compose exec -T db mysql \
  -u root \
  -p$MYSQL_ROOT_PASSWORD \
  agro_intel < $BACKUP_DIR/db_*.sql

# 7. Instalar dependências
echo "7️⃣  Instalando dependências..."
pnpm install

# 8. Iniciar aplicação
echo "8️⃣  Iniciando aplicação..."
docker-compose up -d app

# 9. Validar
echo "9️⃣  Validando sistema..."
sleep 5
curl -s http://localhost:3000/health | jq .

echo "✅ Recuperação concluída!"
```

### Cenário 2: Banco Corrompido

```bash
# 1. Parar aplicação
docker-compose stop app

# 2. Backup do banco corrompido
docker-compose exec -T db mysqldump -u root -p$MYSQL_ROOT_PASSWORD agro_intel \
  > backups/corrupted_$(date +%Y%m%d_%H%M%S).sql

# 3. Recriar banco
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "DROP DATABASE agro_intel; CREATE DATABASE agro_intel;"

# 4. Restaurar de backup
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD agro_intel \
  < backups/db_20260511_120000.sql

# 5. Reiniciar aplicação
docker-compose up -d app
```

### Cenário 3: Aplicação Travada

```bash
# 1. Verificar logs
docker-compose logs app | tail -50

# 2. Parar aplicação
docker-compose stop app

# 3. Limpar cache
docker-compose exec -T app rm -rf node_modules/.cache

# 4. Reiniciar
docker-compose up -d app

# 5. Validar
curl http://localhost:3000/health
```

---

## Restauração Parcial

### Restaurar Apenas Código

```bash
# Extrair código do backup
tar -xzf backups/code_20260511_120000.tar.gz

# Reinstalar dependências
pnpm install

# Reiniciar aplicação
docker-compose restart app
```

### Restaurar Apenas Banco

```bash
# Ver backups disponíveis
ls -lh backups/db_*.sql

# Restaurar
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD agro_intel \
  < backups/db_20260511_120000.sql
```

---

## Verificação de Integridade

### Testar Backup

```bash
#!/bin/bash
# scripts/test-backup.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Uso: ./test-backup.sh <backup_file.sql>"
    exit 1
fi

echo "🔍 Testando integridade do backup..."

# Verificar se arquivo existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado"
    exit 1
fi

# Verificar tamanho
SIZE=$(du -h $BACKUP_FILE | cut -f1)
echo "✅ Arquivo: $SIZE"

# Verificar se é SQL válido
if head -1 $BACKUP_FILE | grep -q "MySQL dump"; then
    echo "✅ Formato SQL válido"
else
    echo "❌ Formato inválido"
    exit 1
fi

# Contar tabelas
TABLES=$(grep "CREATE TABLE" $BACKUP_FILE | wc -l)
echo "✅ Tabelas: $TABLES"

# Contar registros (estimado)
RECORDS=$(grep "INSERT INTO" $BACKUP_FILE | wc -l)
echo "✅ Inserts: $RECORDS"

echo "✅ Backup parece estar OK"
```

### Validar Restauração

```bash
#!/bin/bash
# scripts/validate-restore.sh

echo "🔍 Validando restauração..."

# Verificar banco
echo "1. Verificando banco de dados..."
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD agro_intel \
  -e "SELECT COUNT(*) as users FROM users; SELECT COUNT(*) as weatherLogs FROM weatherLogs; SELECT COUNT(*) as marketAlerts FROM marketAlerts;"

# Verificar aplicação
echo "2. Verificando aplicação..."
curl -s http://localhost:3000/health | jq .

# Verificar Telegram
echo "3. Verificando Telegram..."
curl -s http://localhost:3000/api/trpc/jobs.getTelegramQueueStatus | jq .

echo "✅ Validação concluída"
```

---

## Checklist de Recuperação

### Antes de Restaurar

- [ ] Backup recente disponível
- [ ] Espaço em disco suficiente (2x tamanho do backup)
- [ ] Acesso ao servidor
- [ ] Senha do MySQL
- [ ] Variáveis de ambiente (.env)
- [ ] Documentação de procedimento

### Durante a Restauração

- [ ] Parar aplicação
- [ ] Fazer backup do estado atual
- [ ] Restaurar banco de dados
- [ ] Restaurar código (se necessário)
- [ ] Executar migrations
- [ ] Reiniciar aplicação

### Após a Restauração

- [ ] Validar health check
- [ ] Verificar logs
- [ ] Testar funcionalidades críticas
- [ ] Validar dados
- [ ] Notificar usuários (se necessário)
- [ ] Documentar incidente

---

## Estratégia de Backup

### Frequência

- **Banco de Dados:** Diariamente às 2h (7 dias de retenção)
- **Código:** Semanalmente (4 semanas de retenção)
- **Migrations:** Semanalmente (4 semanas de retenção)
- **Configuração:** Após mudanças

### Retenção

| Tipo | Frequência | Retenção | Espaço |
|---|---|---|---|
| Banco | Diária | 7 dias | ~500MB |
| Código | Semanal | 4 semanas | ~200MB |
| Migrations | Semanal | 4 semanas | ~50MB |
| Config | Ad-hoc | Indefinido | ~10MB |

### Armazenamento

- **Local:** `/home/ubuntu/agro-intel-canarana/backups/`
- **Remoto (Futuro):** S3, Google Cloud Storage, etc

---

## Monitoramento de Backup

```bash
#!/bin/bash
# scripts/monitor-backups.sh

echo "📊 Status de Backups"
echo ""

# Último backup
LAST_DB=$(ls -t backups/db_*.sql 2>/dev/null | head -1)
if [ -z "$LAST_DB" ]; then
    echo "❌ Nenhum backup de banco encontrado"
else
    LAST_TIME=$(stat -f%Sm -t%Y-%m-%d\ %H:%M:%S $LAST_DB 2>/dev/null || stat -c%y $LAST_DB | cut -d' ' -f1-2)
    LAST_SIZE=$(du -h $LAST_DB | cut -f1)
    echo "✅ Último backup de banco: $LAST_TIME ($LAST_SIZE)"
fi

# Espaço total
TOTAL=$(du -sh backups/ 2>/dev/null | cut -f1)
echo "📦 Espaço total: $TOTAL"

# Número de backups
DB_COUNT=$(ls -1 backups/db_*.sql 2>/dev/null | wc -l)
CODE_COUNT=$(ls -1 backups/code_*.tar.gz 2>/dev/null | wc -l)
echo "📋 Backups: $DB_COUNT DB, $CODE_COUNT Code"
```

---

## Troubleshooting

### Erro: "Access denied for user 'root'"

```bash
# Verificar senha
echo $MYSQL_ROOT_PASSWORD

# Testar conexão
docker-compose exec db mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT 1;"
```

### Erro: "Out of disk space"

```bash
# Verificar espaço
df -h

# Limpar backups antigos
find backups/ -name "db_*.sql" -mtime +30 -delete

# Limpar cache Docker
docker system prune -a
```

### Erro: "Database lock"

```bash
# Verificar processos
docker-compose exec db mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "SHOW PROCESSLIST;"

# Matar processo (se necessário)
docker-compose exec db mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "KILL <process_id>;"
```

---

## Testes Periódicos

### Teste Mensal de Restauração

```bash
# 1. Criar banco de teste
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "CREATE DATABASE agro_intel_test;"

# 2. Restaurar backup para teste
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD agro_intel_test \
  < backups/db_20260511_120000.sql

# 3. Validar
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD agro_intel_test \
  -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM weatherLogs;"

# 4. Limpar
docker-compose exec -T db mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "DROP DATABASE agro_intel_test;"

echo "✅ Teste de restauração concluído com sucesso"
```

---

**Última Atualização:** 11 de maio de 2026  
**Status:** ✅ Documentado e Testado  
**Próxima Revisão:** 11 de junho de 2026
