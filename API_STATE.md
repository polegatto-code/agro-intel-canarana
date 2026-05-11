# API State - AgroIntel Canarana

**Última Atualização:** 11 de maio de 2026  
**Status:** ✅ Operacional

## Visão Geral da API

O AgroIntel Canarana utiliza uma arquitetura híbrida com endpoints HTTP para health/monitoring e procedimentos tRPC para operações de negócio. Toda a comunicação é type-safe end-to-end.

## HTTP Endpoints

### Health & Monitoring

#### GET /health

Retorna status completo de saúde do sistema.

**Resposta (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-11T20:30:00Z",
  "uptime": 3600,
  "database": {
    "status": "connected",
    "latency": 5
  },
  "cache": {
    "status": "operational",
    "size": 1024
  },
  "telegram": {
    "status": "connected",
    "queueSize": 0
  },
  "services": {
    "weather": "operational",
    "news": "operational",
    "llm": "operational"
  }
}
```

---

#### GET /health/live

Liveness probe para Kubernetes/Docker.

**Resposta (200 OK):**
```json
{
  "alive": true
}
```

---

#### GET /health/ready

Readiness probe para Kubernetes/Docker.

**Resposta (200 OK):**
```json
{
  "ready": true,
  "database": "connected",
  "cache": "operational"
}
```

---

#### GET /metrics

Métricas em formato Prometheus.

**Resposta (200 OK):**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 100
http_request_duration_seconds_bucket{le="1"} 1200

# HELP system_memory_bytes System memory usage
# TYPE system_memory_bytes gauge
system_memory_bytes 536870912

# HELP telegram_queue_size Telegram message queue size
# TYPE telegram_queue_size gauge
telegram_queue_size 0

# HELP cache_hit_ratio Cache hit ratio
# TYPE cache_hit_ratio gauge
cache_hit_ratio 0.85
```

---

#### GET /debug/contexts

Debug endpoint para visualizar correlation IDs e contextos ativos.

**Resposta (200 OK):**
```json
{
  "activeContexts": 5,
  "contexts": [
    {
      "requestId": "req-001",
      "executionId": "exec-001",
      "userId": 1,
      "startTime": "2026-05-11T20:30:00Z",
      "duration": 150
    }
  ]
}
```

---

## tRPC Procedures

### Authentication

#### auth.me

Retorna dados do usuário autenticado.

**Tipo:** Public Query  
**Autenticação:** Requerida (via cookie)

**Resposta:**
```typescript
{
  id: 1,
  openId: "user-001",
  name: "José Carvalho",
  email: "jose@example.com",
  role: "user",
  createdAt: Date,
  lastSignedIn: Date
}
```

---

#### auth.logout

Faz logout do usuário (limpa session cookie).

**Tipo:** Protected Mutation  
**Autenticação:** Requerida

**Resposta:**
```typescript
{
  success: true
}
```

---

### Jobs & Testing

#### jobs.triggerWeatherCheck

Dispara manualmente a coleta climática e análise.

**Tipo:** Protected Mutation  
**Autenticação:** Requerida

**Resposta:**
```typescript
{
  success: true,
  message: "Weather check triggered",
  result: {
    temperature: 22.5,
    humidity: 65,
    windSpeed: 8.2,
    classification: "excelente",
    operationalScore: 92,
    applicationWindowStart: 5,
    applicationWindowEnd: 14,
    risks: ["low-drift"]
  }
}
```

---

#### jobs.triggerMarketAnalysis

Dispara manualmente a coleta e análise de notícias de mercado.

**Tipo:** Protected Mutation  
**Autenticação:** Requerida

**Resposta:**
```typescript
{
  success: true,
  message: "Market analysis triggered",
  result: {
    alertsCollected: 3,
    analysisGenerated: true,
    scenarioInterpretation: "Dólar em alta...",
    recommendations: "Recomenda-se...",
    riskLevel: "medium"
  }
}
```

---

#### jobs.sendTestTelegramMessage

Envia mensagem de teste via Telegram.

**Tipo:** Protected Mutation  
**Autenticação:** Requerida

**Resposta:**
```typescript
{
  success: true,
  message: "Test message sent",
  messageId: "telegram-msg-001"
}
```

---

#### jobs.getLogs

Retorna logs recentes do sistema.

**Tipo:** Protected Query  
**Autenticação:** Requerida

**Parâmetros:**
```typescript
{
  limit?: number;        // Padrão: 50
  level?: "debug" | "info" | "warn" | "error";
  service?: string;      // "weather", "telegram", "llm", etc
}
```

**Resposta:**
```typescript
[
  {
    timestamp: "2026-05-11T20:30:00Z",
    level: "info",
    service: "weather",
    message: "Weather check completed",
    correlationId: "corr-001",
    duration: 1234
  }
]
```

---

#### jobs.getRecentErrors

Retorna erros recentes do sistema.

**Tipo:** Protected Query  
**Autenticação:** Requerida

**Resposta:**
```typescript
[
  {
    timestamp: "2026-05-11T20:25:00Z",
    service: "telegram",
    error: "Failed to send message",
    retryCount: 2,
    nextRetry: "2026-05-11T20:26:00Z"
  }
]
```

---

#### jobs.getTelegramQueueStatus

Retorna status da fila de mensagens Telegram.

**Tipo:** Protected Query  
**Autenticação:** Requerida

**Resposta:**
```typescript
{
  queueSize: 2,
  pendingMessages: [
    {
      id: "msg-001",
      priority: "high",
      content: "Janela de aplicação: 5h-14h",
      createdAt: "2026-05-11T20:30:00Z",
      retries: 0
    }
  ],
  successRate: 0.98,
  averageDeliveryTime: 500
}
```

---

#### jobs.getCacheStats

Retorna estatísticas de cache.

**Tipo:** Protected Query  
**Autenticação:** Requerida

**Resposta:**
```typescript
{
  totalEntries: 42,
  hitRate: 0.87,
  missRate: 0.13,
  memoryUsage: 2048,
  entries: [
    {
      key: "weather-canarana-2026-05-11",
      size: 512,
      ttl: 3600,
      hits: 15
    }
  ]
}
```

---

#### jobs.healthCheck

Retorna verificação completa de saúde (equivalente a GET /health).

**Tipo:** Public Query  
**Autenticação:** Não requerida

**Resposta:**
```typescript
{
  status: "healthy",
  database: "connected",
  cache: "operational",
  telegram: "connected",
  services: {
    weather: "operational",
    news: "operational",
    llm: "operational"
  }
}
```

---

## Autenticação

### Fluxo OAuth

1. Usuário clica em "Login"
2. Redireciona para `/api/oauth/callback?returnPath=/dashboard`
3. Sistema valida token OAuth do Manus
4. Cria/atualiza usuário no banco
5. Define session cookie
6. Redireciona para `returnPath`

### Session Cookie

- **Nome:** `__Secure-session`
- **Duração:** 30 dias
- **Flags:** Secure, HttpOnly, SameSite=None
- **Escopo:** Todo o domínio

### Validação de Requisições

Todas as requisições protegidas requerem:
1. Session cookie válido
2. Usuário ativo no banco
3. Role apropriado (user ou admin)

---

## Middlewares

### Authentication Middleware

Valida session cookie em todas as requisições protegidas.

```typescript
// Injetado automaticamente em protectedProcedure
ctx.user = {
  id: 1,
  openId: "user-001",
  role: "user"
}
```

### Logging Middleware

Registra todas as requisições com correlation ID.

```typescript
// Headers injetados
X-Request-ID: req-001
X-Correlation-ID: corr-001
X-Execution-ID: exec-001
```

### Error Handling Middleware

Captura e formata erros de forma consistente.

```typescript
// Erro padrão
{
  code: "INTERNAL_SERVER_ERROR",
  message: "Something went wrong",
  correlationId: "corr-001"
}
```

---

## Payloads

### Weather Check Response

```typescript
{
  temperature: number;           // °C
  humidity: number;              // 0-100 %
  windSpeed: number;             // km/h
  hourlyForecast: Array<{
    hour: number;
    temperature: number;
    humidity: number;
    windSpeed: number;
    isRecommended: boolean;
    classification: string;
  }>;
  applicationWindowStart: number; // 0-23
  applicationWindowEnd: number;   // 0-23
  operationalScore: number;       // 0-100
  classification: string;         // excelente, boa, moderada, ruim, nao-recomendada
  identifiedRisks: Array<{
    type: string;               // drift, volatilization, etc
    severity: string;           // low, medium, high
    description: string;
  }>;
}
```

### Market Analysis Response

```typescript
{
  dollarTrend: string;           // up, down, stable
  dollarAnalysis: string;
  inputsTrend: string;
  inputsAnalysis: string;
  cropsTrend: string;
  cropsAnalysis: string;
  geopoliticalAnalysis: string;
  logisticsAnalysis: string;
  scenarioInterpretation: string;
  recommendations: string;
  riskLevel: string;             // low, medium, high, critical
  affectedInputs: string[];
  affectedCrops: string[];
}
```

---

## Retry & Fallback

### Retry Strategy

| Serviço | Tentativas | Delay Inicial | Backoff |
|---|---|---|---|
| OpenWeatherMap | 3 | 1s | exponencial |
| Telegram | 5 | 2s | exponencial |
| LLM | 3 | 2s | exponencial |
| Banco de Dados | 3 | 100ms | linear |

### Circuit Breaker

- **Threshold:** 5 falhas consecutivas
- **Timeout:** 60 segundos
- **Estados:** Closed, Open, Half-Open

---

## Status Codes

| Código | Significado |
|---|---|
| 200 | Sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Não autorizado |
| 404 | Não encontrado |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |
| 503 | Serviço indisponível |

---

## Rate Limiting

### Limites por Endpoint

| Endpoint | Limite | Janela |
|---|---|---|
| /health | Ilimitado | - |
| /metrics | 100 req/min | 1 min |
| jobs.* | 10 req/min | 1 min |
| auth.* | 5 req/min | 1 min |

---

## Exemplos de Uso

### cURL - Health Check

```bash
curl http://localhost:3000/health
```

### cURL - Trigger Weather

```bash
curl -X POST http://localhost:3000/api/trpc/jobs.triggerWeatherCheck \
  -H "Content-Type: application/json" \
  -d '{}' \
  --cookie "__Secure-session=..."
```

### JavaScript/Fetch

```typescript
const result = await trpc.jobs.triggerWeatherCheck.mutate();
console.log(result);
```

### React Hook

```typescript
const { mutate } = trpc.jobs.triggerWeatherCheck.useMutation();

const handleTrigger = async () => {
  const result = await mutate();
  console.log(result);
};
```

---

## Observabilidade

### Correlation ID Flow

```
Request → X-Request-ID (gerado)
        → X-Correlation-ID (propagado)
        → X-Execution-ID (gerado)
        → Logs estruturados
        → Prometheus metrics
        → Response headers
```

### Métricas Rastreadas

- Latência de requisição
- Taxa de erro
- Tamanho de payload
- Cache hit/miss
- Fila Telegram
- Memória do sistema
- CPU do sistema

---

**Última Sincronização:** 11 de maio de 2026  
**Status:** ✅ Documentação Completa
