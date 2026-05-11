# Roadmap Futuro - AgroIntel Canarana

**Última Atualização:** 11 de maio de 2026  
**Status:** 📋 Planejamento Estratégico

## Visão Geral

Este documento descreve o roadmap de features futuras para o AgroIntel Canarana, organizado em três pilares: **Agronômico**, **Comercial** e **IA**.

---

## Pilar 1: Inteligência Agronômica

### 1.1 Monitoramento de Doenças

**Objetivo:** Detectar e alertar sobre riscos fitossanitários em tempo real.

**Features:**
- Risco de ferrugem asiática (soja)
- Risco de antracnose (milho)
- Risco de oídio (trigo)
- Risco de mancha-branca (milho)
- Previsão de epidemias baseada em clima

**Implementação:**
```typescript
// server/services/diseaseRisk.ts
interface DiseaseRisk {
  disease: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  temperature: number;
  humidity: number;
  leafWetness: number;
  daysToEpidemic: number;
  recommendation: string;
}
```

**Dados Necessários:**
- Temperatura horária
- Umidade relativa horária
- Molhamento foliar
- Histórico de chuva
- Estágio fenológico da cultura

**Fontes:**
- Embrapa (modelos de risco)
- INMET (dados climáticos)
- Estações meteorológicas locais

---

### 1.2 Evapotranspiração (ET) e VPD

**Objetivo:** Calcular demanda hídrica e déficit de pressão de vapor para otimizar irrigação.

**Features:**
- Cálculo de ET0 (Penman-Monteith)
- Cálculo de ETc (ET da cultura)
- VPD (Vapor Pressure Deficit)
- Recomendação de irrigação
- Histórico de demanda hídrica

**Implementação:**
```typescript
// server/services/hydrometrics.ts
interface HydroMetrics {
  et0: number;        // mm/dia
  etc: number;        // mm/dia
  vpd: number;        // kPa
  soilMoisture: number; // %
  irrigationNeeded: boolean;
  recommendedVolume: number; // mm
}
```

**Dados Necessários:**
- Radiação solar
- Temperatura máxima e mínima
- Umidade relativa
- Velocidade do vento
- Pressão atmosférica

---

### 1.3 Previsão de Pulverização Otimizada

**Objetivo:** Identificar janelas de aplicação ideais considerando múltiplos fatores.

**Features:**
- Janela operacional por hora (hoje já temos)
- Previsão para próximos 7 dias
- Otimização de rotas de pulverização
- Histórico de aplicações
- Recomendação de volume de calda

**Implementação:**
```typescript
// server/services/sprayForecast.ts
interface SprayWindow {
  date: Date;
  startTime: number;
  endTime: number;
  quality: 'excellent' | 'good' | 'moderate' | 'poor';
  score: number; // 0-100
  risks: string[];
  recommendations: string[];
}
```

---

### 1.4 Mapa Climático Geoespacial

**Objetivo:** Visualizar variabilidade climática dentro da propriedade.

**Features:**
- Mapa de temperatura por talhão
- Mapa de umidade por talhão
- Mapa de vento por talhão
- Mapa de chuva acumulada
- Heatmaps de risco

**Tecnologia:**
- Google Maps API
- Leaflet.js
- Mapbox
- Dados de estações distribuídas

---

### 1.5 Histórico por Talhão

**Objetivo:** Rastrear dados climáticos e operacionais por talhão.

**Features:**
- Registro de cada aplicação
- Dados climáticos no momento da aplicação
- Resultado da aplicação (eficácia)
- Comparação de talhões
- Análise de tendências por talhão

**Schema:**
```sql
CREATE TABLE talhao_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  talhaoId INT NOT NULL,
  dataAplicacao TIMESTAMP,
  cultura VARCHAR(50),
  defensivo VARCHAR(100),
  temperatura DECIMAL(5,2),
  umidade DECIMAL(5,2),
  vento DECIMAL(5,2),
  eficacia DECIMAL(5,2),
  notas TEXT,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (talhaoId) REFERENCES talhoes(id)
);
```

---

## Pilar 2: Inteligência Comercial

### 2.1 Custo Operacional

**Objetivo:** Rastrear e otimizar custos de operação agrícola.

**Features:**
- Custo por hectare de cada operação
- Custo acumulado por safra
- Comparação com benchmark
- Projeção de lucratividade
- Análise de ROI

**Implementação:**
```typescript
// server/services/operationalCost.ts
interface OperationalCost {
  operation: string;
  costPerHectare: number;
  totalArea: number;
  totalCost: number;
  profitability: number; // %
  comparison: 'above' | 'equal' | 'below'; // vs benchmark
}
```

---

### 2.2 Monitor de Fertilizantes

**Objetivo:** Rastrear preços e disponibilidade de insumos.

**Features:**
- Preço diário de Ureia, MAP, KCL, etc.
- Gráficos de tendência
- Alertas de oportunidade de compra
- Recomendação de momento ideal
- Simulação de cenários

**Dados:**
- CBOT (Chicago Board of Trade)
- Cotações locais
- Histórico de preços
- Análise de tendência

**Implementação:**
```typescript
// server/services/fertilizerMonitor.ts
interface FertilizerPrice {
  fertilizer: string;
  price: number;
  currency: string;
  date: Date;
  trend: 'up' | 'down' | 'stable';
  recommendation: 'buy' | 'hold' | 'sell';
}
```

---

### 2.3 Hedge de Dólar

**Objetivo:** Monitorar impacto do dólar nos custos.

**Features:**
- Taxa de câmbio em tempo real
- Impacto no custo de insumos importados
- Simulação de cenários
- Recomendação de hedge
- Histórico de exposição

**Dados:**
- Banco Central do Brasil
- Mercado de futuros
- Análise técnica

---

### 2.4 Monitoramento de Chicago (CBOT)

**Objetivo:** Acompanhar preços internacionais de commodities.

**Features:**
- Preço de soja em Chicago
- Preço de milho em Chicago
- Preço de trigo em Chicago
- Comparação com preços locais
- Análise de oportunidades de exportação

**Dados:**
- CBOT (Chicago Board of Trade)
- CME (Chicago Mercantile Exchange)
- APIs de dados financeiros

---

### 2.5 Monitoramento de Frete

**Objetivo:** Rastrear custos de logística e transporte.

**Features:**
- Preço de frete por rota
- Comparação de transportadoras
- Simulação de cenários
- Histórico de custos
- Recomendação de melhor rota

**Dados:**
- Tabelas de frete
- Preço de combustível
- Distância de rotas

---

## Pilar 3: Inteligência Artificial

### 3.1 Interpretação Agronômica

**Objetivo:** Gerar insights agronômicos automáticos baseados em dados.

**Features:**
- Análise de padrões climáticos
- Identificação de anomalias
- Recomendações baseadas em histórico
- Explicação de fenômenos agrícolas
- Sugestões de ações corretivas

**Implementação:**
```typescript
// server/services/agronomicInsights.ts
interface AgronomicInsight {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  dataPoints: any[];
  confidence: number; // 0-1
}
```

**Exemplo:**
```
"Risco elevado de ferrugem asiática detectado. 
Temperatura média de 22°C + umidade de 75% + 
molhamento foliar prolongado indicam condições 
ideais para infecção. Recomenda-se aplicação 
preventiva de fungicida nos próximos 2 dias."
```

---

### 3.2 Recomendação Operacional

**Objetivo:** Sugerir ações operacionais otimizadas.

**Features:**
- Recomendação de melhor dia para pulverizar
- Recomendação de melhor hora
- Recomendação de defensivo ideal
- Recomendação de volume de calda
- Recomendação de velocidade de aplicação

**Implementação:**
```typescript
// server/services/operationalRecommendation.ts
interface OperationalRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  bestDay: Date;
  bestTime: string; // "06:00-10:00"
  expectedResult: string;
  riskFactors: string[];
  alternativeActions: string[];
}
```

---

### 3.3 Resumo Diário Automático

**Objetivo:** Gerar resumo executivo diário via Telegram.

**Features:**
- Resumo de eventos do dia
- Alertas críticos
- Recomendações prioritárias
- Previsão para próximos dias
- Indicadores-chave

**Formato:**
```
📊 RESUMO DIÁRIO - 11/05/2026

🌡️ CLIMA
• Temperatura: 22-28°C
• Umidade: 65-85%
• Vento: 5-12 km/h
• Chuva: 0mm

⚠️ ALERTAS
• Risco MODERADO de ferrugem
• Janela de aplicação: 06:00-10:00

💡 RECOMENDAÇÕES
• Aplicar fungicida amanhã
• Usar volume de 100 L/ha
• Velocidade: 8 km/h

📈 MERCADO
• Dólar: R$ 5,10 (+0,5%)
• Ureia: R$ 2.100/t (-2%)
• Soja: US$ 12,50 (+0,3%)

🔮 PRÓXIMOS DIAS
• Sexta: Boas condições
• Sábado: Chuva prevista
• Domingo: Ideal para aplicação
```

---

### 3.4 Análise Preditiva

**Objetivo:** Prever cenários futuros com base em dados históricos.

**Features:**
- Previsão de produtividade
- Previsão de risco de doença
- Previsão de preço de commodities
- Previsão de demanda hídrica
- Previsão de impacto de eventos climáticos

**Tecnologia:**
- Time series forecasting (ARIMA, Prophet)
- Machine Learning (Random Forest, XGBoost)
- Deep Learning (LSTM, Transformer)

---

## Roadmap Temporal

### Q2 2026 (Maio-Julho)
- ✅ Sistema base funcionando
- ⏳ APIs reais conectadas
- ⏳ Telegram integrado

### Q3 2026 (Agosto-Outubro)
- [ ] Monitoramento de doenças (ferrugem)
- [ ] Cálculo de ET e VPD
- [ ] Monitor de fertilizantes
- [ ] Histórico por talhão

### Q4 2026 (Novembro-Janeiro)
- [ ] Mapa climático geoespacial
- [ ] Custo operacional
- [ ] Hedge de dólar
- [ ] Interpretação agronômica com LLM

### Q1 2027 (Fevereiro-Abril)
- [ ] Recomendação operacional avançada
- [ ] Resumo diário automático
- [ ] Análise preditiva
- [ ] App mobile

### Q2 2027 (Maio-Julho)
- [ ] Integração com drones
- [ ] Integração com sensores IoT
- [ ] Dashboard executivo
- [ ] Relatórios customizados

---

## Arquitetura Futura

```
┌─────────────────────────────────────────────────────────────┐
│                    AgroIntel Canarana v2.0                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Sensores   │  │   APIs       │  │   Drones     │     │
│  │   IoT        │  │   Externas   │  │   (Futuro)   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           │                                │
│                    ┌──────▼──────┐                         │
│                    │  Data Lake  │                         │
│                    │  (Histórico)│                         │
│                    └──────┬──────┘                         │
│                           │                                │
│  ┌────────────────────────┼────────────────────────┐      │
│  │                        │                        │      │
│  ▼                        ▼                        ▼      │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│ │ Agronômico   │  │ Comercial    │  │ IA Preditiva │     │
│ │ • Doenças    │  │ • Custos     │  │ • Insights   │     │
│ │ • ET/VPD     │  │ • Preços     │  │ • Forecast   │     │
│ │ • Spray      │  │ • Hedge      │  │ • Recomend.  │     │
│ └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│        │                 │                 │              │
│        └─────────────────┼─────────────────┘              │
│                          │                                │
│                   ┌──────▼──────┐                         │
│                   │ LLM Engine   │                         │
│                   │ (Insights)   │                         │
│                   └──────┬───────┘                         │
│                          │                                │
│        ┌─────────────────┼─────────────────┐              │
│        │                 │                 │              │
│        ▼                 ▼                 ▼              │
│    ┌────────┐      ┌──────────┐      ┌──────────┐       │
│    │Telegram│      │Dashboard │      │Relatórios│       │
│    │ Bot    │      │ Web      │      │ PDF      │       │
│    └────────┘      └──────────┘      └──────────┘       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Prioridades

### Curto Prazo (Próximas 4 semanas)
1. Conectar APIs reais (OpenWeatherMap, notícias)
2. Validar coleta climática
3. Testar Telegram em produção
4. Implementar histórico por talhão

### Médio Prazo (1-3 meses)
1. Monitoramento de doenças (ferrugem)
2. Cálculo de ET e VPD
3. Monitor de fertilizantes
4. Interpretação agronômica com LLM

### Longo Prazo (3-6 meses)
1. Análise preditiva
2. Mapa climático geoespacial
3. App mobile
4. Integração com sensores IoT

---

## Tecnologias Sugeridas

| Feature | Tecnologia | Razão |
|---------|-----------|-------|
| Análise Preditiva | Prophet, ARIMA | Time series forecasting |
| ML | XGBoost, Random Forest | Classificação e regressão |
| Deep Learning | LSTM, Transformer | Séries temporais complexas |
| Geoespacial | PostGIS, Mapbox | Dados geográficos |
| IoT | MQTT, InfluxDB | Dados de sensores |
| Drones | OpenDroneMap | Processamento de imagens |
| Mobile | React Native | Cross-platform |

---

## Estimativas de Esforço

| Feature | Complexidade | Horas | Custo |
|---------|-------------|-------|-------|
| Monitoramento de doenças | Alta | 80 | $$$ |
| ET/VPD | Média | 40 | $$ |
| Monitor de fertilizantes | Baixa | 20 | $ |
| Mapa climático | Alta | 100 | $$$ |
| Análise preditiva | Muito Alta | 160 | $$$$ |
| App mobile | Muito Alta | 200 | $$$$ |

---

**Última Atualização:** 11 de maio de 2026  
**Status:** 📋 Planejamento Estratégico  
**Próxima Revisão:** 01 de junho de 2026
