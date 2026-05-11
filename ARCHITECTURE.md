# AgroIntel Canarana - Arquitetura Técnica

## Visão Geral do Sistema

AgroIntel Canarana é uma plataforma de inteligência agrícola que fornece recomendações em tempo real para aplicação de defensivos e monitoramento de mercado de insumos. O sistema é projetado para máxima robustez, escalabilidade e tolerância a falhas.

## Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│              Dashboard | Configurações | Histórico              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    tRPC API (HTTP/WebSocket)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Backend (Express + tRPC)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Endpoints (tRPC Routers)               │  │
│  │  - Settings | Weather | Jobs | Notifications | Health  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │              Integration Service Layer                 │  │
│  │  - Metrics | Circuit Breaker | Retry | Context         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │              Business Logic Services                    │  │
│  │  - Weather | News | Telegram | LLM Analysis            │  │
│  │  - Risk Analysis | Cache | Deduplication               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │              Data Access Layer (Drizzle ORM)           │  │
│  │  - Database Queries | Migrations | Type Safety         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌────────┐         ┌──────────┐         ┌──────────┐
    │ MySQL  │         │ External │         │ Telegram │
    │Database│         │   APIs   │         │   Bot    │
    └────────┘         └──────────┘         └──────────┘
```

## Componentes Principais

### 1. Frontend (React + Tailwind)
- **Dashboard Principal**: Visualização de clima, janela de aplicação, score operacional
- **Configurações**: Gerenciamento de Telegram, parâmetros climáticos, insumos, culturas
- **Histórico**: Tabelas com filtros, gráficos de tendência, análises comparativas
- **Monitoramento**: Status dos serviços, alertas, métricas

### 2. Backend (Express + tRPC)

#### API Routers
- `settings.*`: Configurações de usuário (Telegram, parâmetros, culturas)
- `weather.*`: Dados climáticos e recomendações
- `market.*`: Alertas de mercado e análises
- `jobs.*`: Execução manual de tarefas agendadas
- `notifications.*`: Histórico de notificações
- `healthcheck.*`: Status do sistema

#### Serviços de Integração
- **Integration Service**: Orquestra todos os serviços críticos com proteção
- **Metrics Service**: Coleta de métricas de performance
- **Circuit Breaker**: Proteção contra cascata de falhas
- **Retry Service**: Retry exponencial com fallback
- **Context Service**: Rastreamento de requisições com correlation IDs

#### Serviços de Negócio
- **Weather Service**: Coleta climática, classificação operacional, análise de riscos
- **News Collector**: Coleta de notícias agrícolas de múltiplas fontes
- **News Analysis Service**: Análise com LLM, identificação de impacto
- **Telegram Service**: Envio com prioridades, fila, retry automático
- **OpenWeather Service**: Integração com API de previsão do tempo
- **Cache Service**: Cache em memória com TTL e limpeza automática
- **Rate Limiter**: Proteção contra excesso de requisições
- **Deduplication Service**: Evita alertas duplicados (24h janela)

#### Serviços de Infraestrutura
- **Logger Service**: Logging estruturado com níveis e contexto
- **Database Service**: Queries com Drizzle ORM
- **Health Check Service**: Validação de todos os subsistemas
- **Cron Jobs Service**: Agendamento automático de tarefas

### 3. Banco de Dados (MySQL)

#### Tabelas Principais
- `users`: Usuários do sistema
- `userSettings`: Configurações por usuário (Telegram, parâmetros)
- `weatherLogs`: Logs brutos de clima
- `weatherDailySummary`: Resumo diário com classificação e score
- `marketAlerts`: Alertas de mercado
- `marketAnalysisDaily`: Análise diária de mercado
- `notificationLogs`: Histórico de notificações
- `scheduledJobs`: Registro de execução de jobs

## Fluxo de Dados

### 1. Coleta Climática (5h da manhã)

```
Cron Job (5h)
    ↓
Weather Service
    ├─→ OpenWeather API (com Circuit Breaker + Retry)
    ├─→ Classificação Operacional (5 níveis)
    ├─→ Análise de Riscos (5 tipos)
    ├─→ Cálculo de Score (0-100)
    ├─→ Identificação de Janela de Aplicação
    ↓
Persistência no Banco
    ├─→ weatherLogs (dados brutos)
    ├─→ weatherDailySummary (resumo + classificação)
    ↓
Telegram Service
    ├─→ Fila de Mensagens
    ├─→ Retry Automático (5 tentativas)
    ├─→ Fallback (armazenar para reenvio)
    ↓
Notificação Enviada
```

### 2. Análise de Mercado (6h da manhã)

```
Cron Job (6h)
    ↓
News Collector
    ├─→ Múltiplas Fontes (Embrapa, Conab, Agrolink, etc)
    ├─→ Cache (12h TTL)
    ├─→ Rate Limiting
    ↓
News Analysis Service
    ├─→ LLM Analysis (com Retry)
    ├─→ Identificação de Insumos Afetados
    ├─→ Identificação de Culturas Afetadas
    ├─→ Classificação de Risco
    ├─→ Recomendações Práticas
    ↓
Persistência no Banco
    ├─→ marketAlerts (alertas brutos)
    ├─→ marketAnalysisDaily (análise resumida)
    ↓
Telegram Service
    ├─→ Envio com Prioridade (high/critical)
    ├─→ Retry Automático
    ↓
Boletim Enviado
```

## Padrões de Resiliência

### 1. Circuit Breaker
Protege contra cascata de falhas em APIs externas:
- **Closed**: Requisições passam normalmente
- **Open**: Requisições são rejeitadas (timeout configurável)
- **Half-Open**: Tenta recuperação gradual

### 2. Retry Exponencial
Retry automático com backoff:
- Tentativas configuráveis (padrão: 3)
- Delay exponencial (1s, 2s, 4s...)
- Jitter para evitar thundering herd
- Fallback entre fontes

### 3. Timeout
Proteção contra requisições travadas:
- Weather: 10s
- News: 15s
- Telegram: 5s

### 4. Deduplicação
Evita alertas duplicados:
- Janela de 24h
- Hash baseado em conteúdo
- Armazenamento em cache

## Observabilidade

### Métricas Coletadas
- Requisições por serviço (total, sucesso, falha)
- Tempo de execução (min, max, média)
- Taxa de erro por serviço
- Uso de memória (heap, RSS)
- Tamanho de fila Telegram
- Status de circuit breaker
- Latência de APIs externas

### Logs Estruturados
```json
{
  "timestamp": "2026-05-11T05:00:00Z",
  "service": "weather-service",
  "action": "collect_weather",
  "level": "info",
  "status": "success",
  "message": "Weather collected successfully",
  "duration": 1234,
  "requestId": "abc123",
  "executionId": "def456",
  "correlationId": "ghi789",
  "userId": 1,
  "metadata": {
    "temperature": 25.5,
    "humidity": 65,
    "windSpeed": 8.5
  }
}
```

### Health Check
Valida todos os subsistemas:
- Banco de dados
- Cache
- Telegram
- Weather API
- News API
- Cron jobs
- Memória
- Rate limiter

## Escalabilidade

### Multi-Tenant
- Isolamento por usuário
- Configurações individuais
- Regras por cultura
- Regiões independentes

### Múltiplas Fazendas
- Suporte a múltiplas localizações
- Configurações por fazenda
- Histórico separado

### Múltiplas Culturas
- Parâmetros específicos por cultura
- Monitoramento de insumos por cultura
- Análise de risco por cultura

## Deploy

### Ambiente Local
```bash
docker-compose up -d
```

### Ambiente de Produção
```bash
docker build -t agro-intel:latest .
docker run -d \
  --name agro-intel \
  -p 3000:3000 \
  -e DATABASE_URL=... \
  agro-intel:latest
```

### Graceful Shutdown
- Aguarda conclusão de jobs em execução
- Fecha conexões com banco de dados
- Envia alertas pendentes
- Timeout: 30s

## Segurança

### Autenticação
- Manus OAuth
- Session cookies
- JWT tokens

### Autorização
- Isolamento por usuário
- Role-based access control (admin/user)

### Dados Sensíveis
- Telegram token em variáveis de ambiente
- API keys em secrets
- Sem logging de dados sensíveis

## Troubleshooting

### Problema: Alertas não sendo enviados
1. Verificar circuit breaker de Telegram
2. Validar token e chat ID do Telegram
3. Verificar fila de mensagens
4. Consultar logs de retry

### Problema: Coleta de clima falhando
1. Verificar circuit breaker de Weather API
2. Validar chave de API
3. Verificar conectividade de rede
4. Consultar logs de erro

### Problema: Memória crescendo
1. Verificar tamanho de cache
2. Validar limpeza de contextos
3. Monitorar métricas
4. Reiniciar se necessário

## Próximas Melhorias

1. **Persistência Histórica**: Snapshots diários para análise de tendências
2. **Inteligência Agronômica**: Recomendações preditivas baseadas em IA
3. **Mapas**: Visualização geográfica de fazendas e condições
4. **Alertas Urgentes**: Sistema de prioridades com notificação imediata
5. **Integração de Sensores**: Dados em tempo real de estações meteorológicas
6. **API Pública**: Acesso programático para integrações externas
7. **Mobile App**: Aplicativo nativo para iOS/Android
8. **Análise Preditiva**: Previsão de preços e demanda
