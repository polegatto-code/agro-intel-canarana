# Database State - AgroIntel Canarana

**Última Atualização:** 11 de maio de 2026  
**Status:** ✅ Sincronizado e Operacional

## Schema Completo

O banco de dados do AgroIntel Canarana possui 9 tabelas principais, todas sincronizadas entre o ORM (Drizzle) e o banco MySQL. O schema foi projetado para suportar multi-tenant, com isolamento de dados por usuário.

## Tabelas

### 1. users

**Propósito:** Autenticação e identificação de usuários via Manus OAuth.

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lastSignedIn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `id` (INT): Chave primária auto-incrementada
- `openId` (VARCHAR 64): Identificador único do Manus OAuth
- `name` (TEXT): Nome do usuário
- `email` (VARCHAR 320): Email do usuário
- `loginMethod` (VARCHAR 64): Método de login (manus, google, etc)
- `role` (ENUM): Papel do usuário (user ou admin)
- `createdAt` (TIMESTAMP): Data de criação
- `updatedAt` (TIMESTAMP): Data de última atualização
- `lastSignedIn` (TIMESTAMP): Último login

**Índices:** PRIMARY KEY (id), UNIQUE (openId)

**Registros:** 1 (usuário de teste)

---

### 2. userSettings

**Propósito:** Configurações personalizadas por usuário (Telegram, parâmetros climáticos, culturas monitoradas).

```sql
CREATE TABLE userSettings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  telegramToken VARCHAR(255) NOT NULL,
  telegramChatId VARCHAR(255) NOT NULL,
  minHumidity INT NOT NULL DEFAULT 50,
  maxHumidity INT NOT NULL DEFAULT 90,
  maxTemperature INT NOT NULL DEFAULT 30,
  maxWindSpeed INT NOT NULL DEFAULT 15,
  monitoredCrops JSON NOT NULL,
  marketAlertFrequency ENUM('daily', 'weekly') NOT NULL DEFAULT 'daily',
  monitoredInputs JSON NOT NULL,
  enableWeatherNotifications BOOLEAN NOT NULL DEFAULT true,
  enableMarketNotifications BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Campos:**
- `id` (INT): Chave primária
- `userId` (INT): Referência ao usuário
- `telegramToken` (VARCHAR 255): Token do bot Telegram
- `telegramChatId` (VARCHAR 255): Chat ID para receber notificações
- `minHumidity` (INT): Umidade relativa mínima ideal (padrão: 50%)
- `maxHumidity` (INT): Umidade relativa máxima ideal (padrão: 90%)
- `maxTemperature` (INT): Temperatura máxima ideal (padrão: 30°C)
- `maxWindSpeed` (INT): Velocidade máxima de vento (padrão: 15 km/h)
- `monitoredCrops` (JSON): Array de culturas monitoradas (soja, milho, sorgo, milheto, gergelim)
- `marketAlertFrequency` (ENUM): Frequência de alertas (daily ou weekly)
- `monitoredInputs` (JSON): Array de insumos monitorados (ureia, map, kcl, etc)
- `enableWeatherNotifications` (BOOLEAN): Ativar notificações climáticas
- `enableMarketNotifications` (BOOLEAN): Ativar notificações de mercado
- `createdAt` (TIMESTAMP): Data de criação
- `updatedAt` (TIMESTAMP): Data de última atualização

**Registros:** 0 (pronto para dados)

---

### 3. weatherLogs

**Propósito:** Registro detalhado de coleta climática com forecast horário e classificação operacional.

```sql
CREATE TABLE weatherLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  temperature DECIMAL(5,2) NOT NULL,
  humidity INT NOT NULL,
  windSpeed DECIMAL(5,2) NOT NULL,
  hourlyForecast JSON NOT NULL,
  applicationWindowStart INT,
  applicationWindowEnd INT,
  isApplicationRecommended BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(64) NOT NULL DEFAULT 'openweathermap',
  recordedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `id` (INT): Chave primária
- `userId` (INT): Referência ao usuário
- `temperature` (DECIMAL 5,2): Temperatura atual em °C
- `humidity` (INT): Umidade relativa em %
- `windSpeed` (DECIMAL 5,2): Velocidade do vento em km/h
- `hourlyForecast` (JSON): Array com 24 horas de previsão:
  ```json
  [
    {
      "hour": 5,
      "temperature": 18.5,
      "humidity": 75,
      "windSpeed": 8.2,
      "isRecommended": true,
      "classification": "excelente"
    }
  ]
  ```
- `applicationWindowStart` (INT): Hora de início da janela recomendada (0-23)
- `applicationWindowEnd` (INT): Hora de fim da janela recomendada (0-23)
- `isApplicationRecommended` (BOOLEAN): Se há janela recomendada para o dia
- `source` (VARCHAR 64): Fonte de dados (openweathermap)
- `recordedAt` (TIMESTAMP): Hora da coleta
- `createdAt` (TIMESTAMP): Hora de registro no banco

**Classificações:** excelente, boa, moderada, ruim, nao-recomendada

**Registros:** 0 (pronto para coleta)

---

### 4. weatherDailySummary

**Propósito:** Resumo diário consolidado de clima com score operacional e análise de riscos.

```sql
CREATE TABLE weatherDailySummary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  date DATE NOT NULL,
  avgTemperature DECIMAL(5,2),
  minTemperature DECIMAL(5,2),
  maxTemperature DECIMAL(5,2),
  avgHumidity INT,
  minHumidity INT,
  maxHumidity INT,
  avgWindSpeed DECIMAL(5,2),
  maxWindSpeed DECIMAL(5,2),
  applicationWindowStart INT,
  applicationWindowEnd INT,
  classification ENUM('excelente', 'boa', 'moderada', 'ruim', 'nao-recomendada') NOT NULL,
  operationalScore INT,
  identifiedRisks JSON,
  rainProbability INT,
  rainAmount DECIMAL(5,2),
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `date` (DATE): Data do resumo
- `avgTemperature` (DECIMAL): Temperatura média
- `minTemperature` (DECIMAL): Temperatura mínima
- `maxTemperature` (DECIMAL): Temperatura máxima
- `avgHumidity` (INT): Umidade média
- `minHumidity` (INT): Umidade mínima
- `maxHumidity` (INT): Umidade máxima
- `avgWindSpeed` (DECIMAL): Velocidade média do vento
- `maxWindSpeed` (DECIMAL): Velocidade máxima do vento
- `applicationWindowStart` (INT): Hora de início da melhor janela
- `applicationWindowEnd` (INT): Hora de fim da melhor janela
- `classification` (ENUM): Classificação operacional geral
- `operationalScore` (INT): Score 0-100 da qualidade operacional
- `identifiedRisks` (JSON): Array de riscos identificados:
  ```json
  [
    {"type": "drift", "severity": "low", "description": "Vento moderado"},
    {"type": "volatilization", "severity": "medium", "description": "Temperatura alta"}
  ]
  ```
- `rainProbability` (INT): Probabilidade de chuva em %
- `rainAmount` (DECIMAL): Quantidade de chuva prevista em mm

**Registros:** 0 (pronto para resumos diários)

---

### 5. marketAlerts

**Propósito:** Alertas individuais de mercado com análise LLM e impacto estimado.

```sql
CREATE TABLE marketAlerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  aiAnalysis TEXT,
  affectedInputs JSON NOT NULL,
  affectedCrops JSON NOT NULL,
  impactLevel ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  source VARCHAR(255),
  sourceUrl VARCHAR(500),
  notificationSent BOOLEAN NOT NULL DEFAULT false,
  notificationSentAt TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Campos:**
- `title` (VARCHAR 255): Título do alerta
- `summary` (TEXT): Resumo da notícia
- `aiAnalysis` (TEXT): Análise contextualizada por LLM
- `affectedInputs` (JSON): Insumos afetados (ureia, map, kcl, etc)
- `affectedCrops` (JSON): Culturas afetadas (soja, milho, etc)
- `impactLevel` (ENUM): Nível de impacto (low, medium, high)
- `source` (VARCHAR 255): Fonte da notícia
- `sourceUrl` (VARCHAR 500): URL da notícia original
- `notificationSent` (BOOLEAN): Se notificação foi enviada
- `notificationSentAt` (TIMESTAMP): Quando foi enviada

**Registros:** 0 (pronto para alertas)

---

### 6. marketAnalysisDaily

**Propósito:** Análise consolidada diária de mercado com interpretação de cenário.

```sql
CREATE TABLE marketAnalysisDaily (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  date DATE NOT NULL,
  dollarTrend VARCHAR(50),
  dollarAnalysis TEXT,
  inputsTrend VARCHAR(50),
  inputsAnalysis TEXT,
  cropsTrend VARCHAR(50),
  cropsAnalysis TEXT,
  geopoliticalAnalysis TEXT,
  logisticsAnalysis TEXT,
  scenarioInterpretation TEXT,
  recommendations TEXT,
  riskLevel ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  notificationSent BOOLEAN NOT NULL DEFAULT false,
  notificationSentAt TIMESTAMP,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Campos:**
- `date` (DATE): Data da análise
- `dollarTrend` (VARCHAR): Tendência do dólar (up, down, stable)
- `dollarAnalysis` (TEXT): Análise detalhada do dólar
- `inputsTrend` (VARCHAR): Tendência de insumos
- `inputsAnalysis` (TEXT): Análise de preços de insumos
- `cropsTrend` (VARCHAR): Tendência de commodities
- `cropsAnalysis` (TEXT): Análise de preços de commodities
- `geopoliticalAnalysis` (TEXT): Análise de eventos geopolíticos
- `logisticsAnalysis` (TEXT): Análise de logística e distribuição
- `scenarioInterpretation` (TEXT): Interpretação consolidada do cenário
- `recommendations` (TEXT): Recomendações operacionais
- `riskLevel` (ENUM): Nível de risco geral
- `notificationSent` (BOOLEAN): Se boletim foi enviado

**Registros:** 0 (pronto para análises diárias)

---

### 7. notificationLogs

**Propósito:** Histórico completo de notificações enviadas (clima, mercado, alertas).

```sql
CREATE TABLE notificationLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('weather', 'market') NOT NULL,
  referenceId INT,
  messageContent TEXT NOT NULL,
  deliveryStatus ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  deliveryError TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sentAt TIMESTAMP
);
```

**Campos:**
- `type` (ENUM): Tipo de notificação (weather ou market)
- `referenceId` (INT): ID do weatherLog ou marketAlert
- `messageContent` (TEXT): Conteúdo da mensagem enviada
- `deliveryStatus` (ENUM): Status de entrega (pending, sent, failed)
- `deliveryError` (TEXT): Mensagem de erro se falhou
- `sentAt` (TIMESTAMP): Quando foi enviada com sucesso

**Registros:** 0 (pronto para logs)

---

### 8. scheduledJobs

**Propósito:** Rastreamento de execução de jobs agendados (cron).

```sql
CREATE TABLE scheduledJobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  jobType ENUM('weather_check', 'market_analysis') NOT NULL,
  lastExecutedAt TIMESTAMP,
  lastExecutionStatus ENUM('success', 'failed', 'pending') NOT NULL DEFAULT 'pending',
  lastExecutionError TEXT,
  nextExecutionAt TIMESTAMP,
  isEnabled BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Campos:**
- `jobType` (ENUM): Tipo de job (weather_check às 5h, market_analysis diária/semanal)
- `lastExecutedAt` (TIMESTAMP): Última execução
- `lastExecutionStatus` (ENUM): Status da última execução
- `lastExecutionError` (TEXT): Erro se falhou
- `nextExecutionAt` (TIMESTAMP): Próxima execução agendada
- `isEnabled` (BOOLEAN): Se o job está ativo

**Registros:** 0 (pronto para jobs)

---

### 9. __drizzle_migrations

**Propósito:** Controle de versão de migrations (gerenciado automaticamente pelo Drizzle).

```sql
CREATE TABLE __drizzle_migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hash TEXT NOT NULL,
  created_at BIGINT
);
```

**Registros:** Rastreamento automático de migrations aplicadas

---

## Migrations

### Migration 0000_peaceful_mentor.sql

Criação das tabelas iniciais: marketAlerts, notificationLogs, scheduledJobs, userSettings, weatherLogs.

### Migration 0001_overrated_metal_master.sql

Criação das tabelas de resumo diário: weatherDailySummary, marketAnalysisDaily.

### Migration 0002_amusing_viper.sql

Ajustes adicionais e otimizações.

---

## Índices e Constraints

### Foreign Keys (Planejadas para v1.1)

```sql
ALTER TABLE userSettings ADD CONSTRAINT fk_userSettings_userId 
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE weatherLogs ADD CONSTRAINT fk_weatherLogs_userId 
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE marketAlerts ADD CONSTRAINT fk_marketAlerts_userId 
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;
```

### Índices Recomendados

```sql
-- Performance de queries por usuário
CREATE INDEX idx_userSettings_userId ON userSettings(userId);
CREATE INDEX idx_weatherLogs_userId_date ON weatherLogs(userId, recordedAt);
CREATE INDEX idx_weatherDailySummary_userId_date ON weatherDailySummary(userId, date);
CREATE INDEX idx_marketAlerts_userId_date ON marketAlerts(userId, createdAt);
CREATE INDEX idx_marketAnalysisDaily_userId_date ON marketAnalysisDaily(userId, date);
CREATE INDEX idx_notificationLogs_userId_date ON notificationLogs(userId, createdAt);
CREATE INDEX idx_scheduledJobs_userId_type ON scheduledJobs(userId, jobType);

-- Performance de buscas
CREATE INDEX idx_marketAlerts_impactLevel ON marketAlerts(impactLevel);
CREATE INDEX idx_weatherDailySummary_classification ON weatherDailySummary(classification);
```

---

## Dados Padrão (Seed)

### Usuário de Teste

```sql
INSERT INTO users (openId, name, email, loginMethod, role) 
VALUES ('test-user-001', 'José Carvalho', 'jose@example.com', 'manus', 'user');
```

### Configurações Padrão

```sql
INSERT INTO userSettings (userId, telegramToken, telegramChatId, monitoredCrops, monitoredInputs)
VALUES (1, 'TOKEN_AQUI', '7320282878', 
  '["soja", "milho", "sorgo", "milheto", "gergelim"]',
  '["ureia", "map", "kcl", "super-simples", "super-triplo", "nitrato-amonio", "sulfato-amonio", "npk-20-00-20", "npk-30-00-20"]'
);
```

---

## Consultas Úteis

### Últimas coletas climáticas

```sql
SELECT * FROM weatherLogs 
WHERE userId = 1 
ORDER BY createdAt DESC 
LIMIT 7;
```

### Resumo diário de clima

```sql
SELECT * FROM weatherDailySummary 
WHERE userId = 1 AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
ORDER BY date DESC;
```

### Alertas de mercado não enviados

```sql
SELECT * FROM marketAlerts 
WHERE userId = 1 AND notificationSent = false
ORDER BY createdAt DESC;
```

### Status de jobs agendados

```sql
SELECT * FROM scheduledJobs 
WHERE userId = 1
ORDER BY nextExecutionAt DESC;
```

### Histórico de notificações

```sql
SELECT * FROM notificationLogs 
WHERE userId = 1 
ORDER BY createdAt DESC 
LIMIT 50;
```

---

## Backup e Restore

### Backup Completo

```bash
mysqldump -u root -p agro_intel > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore

```bash
mysql -u root -p agro_intel < backup_20260511_120000.sql
```

### Exportar Schema

```bash
mysqldump -u root -p --no-data agro_intel > schema_$(date +%Y%m%d).sql
```

---

**Última Sincronização:** 11 de maio de 2026  
**Status:** ✅ Todas as 9 tabelas criadas e sincronizadas  
**Próximas Ações:** Adicionar foreign keys e índices na v1.1
