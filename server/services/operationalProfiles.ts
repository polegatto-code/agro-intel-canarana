/**
 * AgroIntel Canarana — Fase 7: Motor Agronômico Operacional Autônomo
 * Módulo: Perfis Operacionais + Calendário Sazonal Regional
 *
 * Região: Vale do Araguaia — Canarana MT
 * Perfil de solo médio: 20-30% argila (arenoso-argiloso)
 *
 * O sistema trabalha com PERFIS OPERACIONAIS, não com produtos específicos.
 * Cada perfil define critérios climáticos, riscos e lógica de decisão autônoma.
 */

import { calculateDeltaT, calculateDewPoint } from './agronomyService';

// ---------------------------------------------------------------------------
// TIPOS DE PERFIL OPERACIONAL
// ---------------------------------------------------------------------------

export type OperationalProfileType =
  | 'herbicida_pre_emergente'
  | 'herbicida_pos_emergente'
  | 'herbicida_contato'
  | 'herbicida_sistemico'
  | 'fungicida_contato'
  | 'fungicida_sistemico'
  | 'fungicida_translaminar'
  | 'dessecacao'
  | 'inoculacao'
  | 'residual';

export type SeasonalPeriod =
  | 'set_nov'  // Setembro→Novembro: dessecação, pré-emergente, implementação soja
  | 'nov_jan'  // Novembro→Janeiro: pré/pós-emergente, fungicida, proteção foliar
  | 'jan_mar'  // Janeiro→Março: fungicida, dessecação soja, implementação safrinha
  | 'mar_abr'  // Março→Abril: aplicações pontuais, fungicida milho
  | 'entressafra'; // Após abril: encerrar alertas climáticos, manter mercado

export type OperationalRisk =
  | 'deriva'
  | 'lavagem'
  | 'evaporacao'
  | 'residual_reduzido'
  | 'absorcao_prejudicada'
  | 'translocacao_reduzida'
  | 'sobrevivencia_biologica'
  | 'inversao_termica'
  | 'volatilizacao';

export interface OperationalProfileConfig {
  type: OperationalProfileType;
  label: string;
  description: string;
  // Limites climáticos
  maxWindSpeed: number;       // km/h — acima disso: risco de deriva
  minHumidity: number;        // % — abaixo: evaporação/cobertura prejudicada
  maxHumidity: number;        // % — acima: risco de lavagem/fitotoxidez
  minTemp: number;            // °C
  maxTemp: number;            // °C
  maxDeltaT: number;          // °C — acima: evaporação excessiva
  minDeltaT: number;          // °C — abaixo: inversão térmica
  // Lógica específica do perfil
  requiresDryPeriodAfterHours: number;  // horas sem chuva necessárias após aplicação
  requiresRainWithinHours: number | null; // horas para chuva de incorporação (pré-emergente)
  soilMoistureRequired: boolean;        // exige umidade no solo
  washRiskRainMm: number;               // mm de chuva que lava o produto
  // Riscos primários deste perfil
  primaryRisks: OperationalRisk[];
}

export interface WeatherSnapshot {
  temperature: number;         // °C
  humidity: number;            // %
  windSpeed: number;           // km/h
  rainProbabilityNow: number;  // % próximas 3h
  rainProbability24h: number;  // % próximas 24h
  rainProbability48h: number;  // % próximas 48h
  rainMmForecast3h: number;    // mm previstos nas próximas 3h
  rainMmForecast24h: number;   // mm previstos nas próximas 24h
  uvIndex?: number;
  soilMoistureEstimate?: 'seco' | 'umido' | 'encharcado'; // estimativa por chuva recente
}

export interface ProfileAnalysisResult {
  profile: OperationalProfileType;
  profileLabel: string;
  recommendation: 'recomendado' | 'aceitavel' | 'nao-recomendado' | 'aguardar';
  score: number; // 0-100
  deltaT: number;
  deltaTStatus: 'ideal' | 'aceitavel' | 'critico';
  activeRisks: { risk: OperationalRisk; severity: 'baixo' | 'moderado' | 'alto' | 'critico'; detail: string }[];
  operationalAlerts: string[];
  recommendation_reason: string;
  isOperationalWindow: boolean;
}

export interface SeasonalContext {
  period: SeasonalPeriod;
  label: string;
  dominantProfiles: OperationalProfileType[];
  operationalPriority: string;
  reduceAlerts: boolean; // true = entressafra, reduzir spam
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DOS PERFIS OPERACIONAIS
// ---------------------------------------------------------------------------

export const OPERATIONAL_PROFILES: Record<OperationalProfileType, OperationalProfileConfig> = {

  herbicida_pre_emergente: {
    type: 'herbicida_pre_emergente',
    label: 'Herbicida Pré-Emergente',
    description: 'Aplicação antes da emergência das plantas. Exige incorporação por chuva ou umidade no solo.',
    maxWindSpeed: 10,
    minHumidity: 50,
    maxHumidity: 85,
    minTemp: 15,
    maxTemp: 32,
    maxDeltaT: 8,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 0,    // não precisa de período seco — precisa de chuva
    requiresRainWithinHours: 72,       // chuva de incorporação em até 72h
    soilMoistureRequired: true,
    washRiskRainMm: 30,                // >30mm pode lavar produto
    primaryRisks: ['lavagem', 'residual_reduzido', 'evaporacao', 'deriva'],
  },

  herbicida_pos_emergente: {
    type: 'herbicida_pos_emergente',
    label: 'Herbicida Pós-Emergente',
    description: 'Aplicação após emergência. Exige cobertura foliar e absorção eficiente.',
    maxWindSpeed: 12,
    minHumidity: 50,
    maxHumidity: 90,
    minTemp: 15,
    maxTemp: 30,
    maxDeltaT: 8,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 4,
    requiresRainWithinHours: null,
    soilMoistureRequired: false,
    washRiskRainMm: 10,
    primaryRisks: ['deriva', 'evaporacao', 'lavagem', 'absorcao_prejudicada'],
  },

  herbicida_contato: {
    type: 'herbicida_contato',
    label: 'Herbicida de Contato',
    description: 'Age por contato direto. Exige cobertura máxima, sem deriva.',
    maxWindSpeed: 10,
    minHumidity: 55,
    maxHumidity: 90,
    minTemp: 15,
    maxTemp: 30,
    maxDeltaT: 7,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 2,
    requiresRainWithinHours: null,
    soilMoistureRequired: false,
    washRiskRainMm: 5,
    primaryRisks: ['deriva', 'evaporacao', 'lavagem'],
  },

  herbicida_sistemico: {
    type: 'herbicida_sistemico',
    label: 'Herbicida Sistêmico',
    description: 'Translocação pelo floema. Planta deve estar ativa, sem estresse hídrico.',
    maxWindSpeed: 12,
    minHumidity: 50,
    maxHumidity: 90,
    minTemp: 18,
    maxTemp: 32,
    maxDeltaT: 9,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 6,
    requiresRainWithinHours: null,
    soilMoistureRequired: false,
    washRiskRainMm: 8,
    primaryRisks: ['translocacao_reduzida', 'deriva', 'lavagem'],
  },

  fungicida_contato: {
    type: 'fungicida_contato',
    label: 'Fungicida de Contato',
    description: 'Proteção superficial. Exige cobertura total e período seco pós-aplicação.',
    maxWindSpeed: 10,
    minHumidity: 50,
    maxHumidity: 85,
    minTemp: 15,
    maxTemp: 28,
    maxDeltaT: 7,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 6,
    requiresRainWithinHours: null,
    soilMoistureRequired: false,
    washRiskRainMm: 8,
    primaryRisks: ['lavagem', 'deriva', 'evaporacao'],
  },

  fungicida_sistemico: {
    type: 'fungicida_sistemico',
    label: 'Fungicida Sistêmico',
    description: 'Absorção e translocação. Período seco pós-aplicação crítico para absorção.',
    maxWindSpeed: 12,
    minHumidity: 50,
    maxHumidity: 85,
    minTemp: 15,
    maxTemp: 30,
    maxDeltaT: 8,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 4,
    requiresRainWithinHours: null,
    soilMoistureRequired: false,
    washRiskRainMm: 10,
    primaryRisks: ['lavagem', 'absorcao_prejudicada', 'deriva'],
  },

  fungicida_translaminar: {
    type: 'fungicida_translaminar',
    label: 'Fungicida Translaminar',
    description: 'Penetra e redistribui no tecido foliar. Absorção rápida, menor risco de lavagem.',
    maxWindSpeed: 12,
    minHumidity: 50,
    maxHumidity: 88,
    minTemp: 15,
    maxTemp: 30,
    maxDeltaT: 8,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 2,
    requiresRainWithinHours: null,
    soilMoistureRequired: false,
    washRiskRainMm: 15,
    primaryRisks: ['deriva', 'evaporacao', 'lavagem'],
  },

  dessecacao: {
    type: 'dessecacao',
    label: 'Dessecação',
    description: 'Manejo pré-colheita ou pré-plantio. Planta deve estar ativa para absorção sistêmica.',
    maxWindSpeed: 12,
    minHumidity: 50,
    maxHumidity: 90,
    minTemp: 18,
    maxTemp: 32,
    maxDeltaT: 9,
    minDeltaT: 2,
    requiresDryPeriodAfterHours: 6,
    requiresRainWithinHours: null,
    soilMoistureRequired: false,
    washRiskRainMm: 8,
    primaryRisks: ['translocacao_reduzida', 'deriva', 'lavagem'],
  },

  inoculacao: {
    type: 'inoculacao',
    label: 'Inoculação',
    description: 'Biológico sensível a UV, temperatura alta e seca. Aplicar em condições amenas.',
    maxWindSpeed: 10,
    minHumidity: 55,
    maxHumidity: 90,
    minTemp: 15,
    maxTemp: 28,
    maxDeltaT: 6,
    minDeltaT: 1,
    requiresDryPeriodAfterHours: 0,
    requiresRainWithinHours: null,
    soilMoistureRequired: true,
    washRiskRainMm: 20,
    primaryRisks: ['sobrevivencia_biologica', 'evaporacao', 'volatilizacao'],
  },

  residual: {
    type: 'residual',
    label: 'Residual (Solo)',
    description: 'Produto com ação residual no solo. Solo arenoso reduz persistência.',
    maxWindSpeed: 12,
    minHumidity: 45,
    maxHumidity: 90,
    minTemp: 15,
    maxTemp: 35,
    maxDeltaT: 10,
    minDeltaT: 1,
    requiresDryPeriodAfterHours: 0,
    requiresRainWithinHours: 48,
    soilMoistureRequired: true,
    washRiskRainMm: 40,
    primaryRisks: ['residual_reduzido', 'lavagem'],
  },
};

// ---------------------------------------------------------------------------
// CALENDÁRIO SAZONAL REGIONAL — VALE DO ARAGUAIA / CANARANA-MT
// ---------------------------------------------------------------------------

/**
 * Determina o período sazonal atual com base no mês.
 */
export function getCurrentSeasonalPeriod(month: number): SeasonalContext {
  if (month >= 9 && month <= 11) {
    return {
      period: 'set_nov',
      label: 'Setembro–Novembro: Implementação Safra Soja',
      dominantProfiles: ['dessecacao', 'herbicida_pre_emergente', 'residual'],
      operationalPriority:
        'Foco em dessecação, pré-emergente e incorporação. Monitorar chuva pós-aplicação para ativação do pré-emergente.',
      reduceAlerts: false,
    };
  } else if (month === 12 || month === 1) {
    return {
      period: 'nov_jan',
      label: 'Novembro–Janeiro: Proteção Foliar e Fungicida',
      dominantProfiles: [
        'fungicida_sistemico',
        'fungicida_translaminar',
        'herbicida_pos_emergente',
        'herbicida_pre_emergente',
      ],
      operationalPriority:
        'Maior peso operacional em fungicida (dezembro–janeiro). Monitorar período seco pós-aplicação. Pressão de doenças elevada.',
      reduceAlerts: false,
    };
  } else if (month >= 1 && month <= 3) {
    return {
      period: 'jan_mar',
      label: 'Janeiro–Março: Fungicida + Implementação Safrinha',
      dominantProfiles: [
        'fungicida_sistemico',
        'dessecacao',
        'herbicida_pre_emergente',
      ],
      operationalPriority:
        'Transição safra/safrinha. Janela operacional se fechando (~25/03). Pressão operacional e climática elevada.',
      reduceAlerts: false,
    };
  } else if (month >= 3 && month <= 4) {
    return {
      period: 'mar_abr',
      label: 'Março–Abril: Aplicações Pontuais',
      dominantProfiles: ['fungicida_sistemico', 'fungicida_contato'],
      operationalPriority:
        'Fungicida milho (folha bandeira, ~10/04 em diante). Reduzir alertas. Evitar spam.',
      reduceAlerts: true,
    };
  } else {
    return {
      period: 'entressafra',
      label: 'Entressafra: Foco em Mercado e Inteligência Econômica',
      dominantProfiles: [],
      operationalPriority:
        'Encerrar alertas climáticos operacionais. Manter monitoramento de mercado, notícias e inteligência econômica.',
      reduceAlerts: true,
    };
  }
}

// ---------------------------------------------------------------------------
// MOTOR DE ANÁLISE POR PERFIL OPERACIONAL
// ---------------------------------------------------------------------------

/**
 * Analisa condições climáticas para um perfil operacional específico.
 * Considera solo arenoso-argiloso (20-30% argila) da região de Canarana-MT.
 */
export function analyzeProfileConditions(
  profile: OperationalProfileType,
  weather: WeatherSnapshot,
  soilTexture: 'arenoso' | 'medio' | 'argiloso' = 'medio'
): ProfileAnalysisResult {
  const config = OPERATIONAL_PROFILES[profile];
  const deltaT = calculateDeltaT(weather.temperature, weather.humidity);

  const activeRisks: ProfileAnalysisResult['activeRisks'] = [];
  const alerts: string[] = [];
  let score = 100;

  // --- Delta T ---
  let deltaTStatus: 'ideal' | 'aceitavel' | 'critico';
  if (deltaT < config.minDeltaT) {
    deltaTStatus = 'critico';
    activeRisks.push({
      risk: 'inversao_termica',
      severity: 'critico',
      detail: `Delta T ${deltaT.toFixed(1)}°C abaixo do mínimo (${config.minDeltaT}°C) — inversão térmica, risco de deriva excessiva.`,
    });
    alerts.push(`⚠️ Delta T crítico (${deltaT.toFixed(1)}°C): inversão térmica. Não aplicar.`);
    score -= 40;
  } else if (deltaT > config.maxDeltaT) {
    deltaTStatus = 'critico';
    activeRisks.push({
      risk: 'evaporacao',
      severity: 'alto',
      detail: `Delta T ${deltaT.toFixed(1)}°C acima do máximo (${config.maxDeltaT}°C) — evaporação excessiva das gotas.`,
    });
    alerts.push(`⚠️ Delta T elevado (${deltaT.toFixed(1)}°C): evaporação excessiva. Aguardar resfriamento.`);
    score -= 30;
  } else if (deltaT > 8 && deltaT <= config.maxDeltaT) {
    deltaTStatus = 'aceitavel';
    score -= 10;
  } else {
    deltaTStatus = 'ideal';
  }

  // --- Vento ---
  if (weather.windSpeed > config.maxWindSpeed) {
    const severity = weather.windSpeed > config.maxWindSpeed * 1.5 ? 'critico' : 'alto';
    activeRisks.push({
      risk: 'deriva',
      severity,
      detail: `Vento ${weather.windSpeed} km/h acima do limite (${config.maxWindSpeed} km/h) para ${config.label}.`,
    });
    alerts.push(`💨 Vento crítico (${weather.windSpeed} km/h): risco de deriva. Limite: ${config.maxWindSpeed} km/h.`);
    score -= severity === 'critico' ? 40 : 25;
  } else if (weather.windSpeed > config.maxWindSpeed * 0.8) {
    activeRisks.push({
      risk: 'deriva',
      severity: 'moderado',
      detail: `Vento ${weather.windSpeed} km/h próximo ao limite (${config.maxWindSpeed} km/h). Monitorar.`,
    });
    score -= 10;
  }

  // --- Temperatura ---
  if (weather.temperature > config.maxTemp) {
    activeRisks.push({
      risk: 'evaporacao',
      severity: weather.temperature > config.maxTemp + 5 ? 'alto' : 'moderado',
      detail: `Temperatura ${weather.temperature}°C acima do máximo (${config.maxTemp}°C) para ${config.label}.`,
    });
    alerts.push(`🌡️ Temperatura elevada (${weather.temperature}°C): eficiência reduzida.`);
    score -= 20;
  } else if (weather.temperature < config.minTemp) {
    activeRisks.push({
      risk: 'absorcao_prejudicada',
      severity: 'moderado',
      detail: `Temperatura ${weather.temperature}°C abaixo do mínimo (${config.minTemp}°C) para ${config.label}.`,
    });
    score -= 15;
  }

  // --- Umidade Relativa ---
  if (weather.humidity < config.minHumidity) {
    activeRisks.push({
      risk: 'evaporacao',
      severity: weather.humidity < config.minHumidity - 15 ? 'alto' : 'moderado',
      detail: `UR ${weather.humidity}% abaixo do mínimo (${config.minHumidity}%) — evaporação prematura das gotas.`,
    });
    alerts.push(`💧 UR baixa (${weather.humidity}%): cobertura e absorção prejudicadas.`);
    score -= 20;
  } else if (weather.humidity > config.maxHumidity) {
    activeRisks.push({
      risk: 'absorcao_prejudicada',
      severity: 'baixo',
      detail: `UR ${weather.humidity}% acima do máximo (${config.maxHumidity}%) — risco de fitotoxidez.`,
    });
    score -= 10;
  }

  // --- Risco de Lavagem (chuva próxima) ---
  if (config.requiresDryPeriodAfterHours > 0) {
    if (weather.rainProbabilityNow > 50) {
      activeRisks.push({
        risk: 'lavagem',
        severity: 'critico',
        detail: `Chuva iminente (${weather.rainProbabilityNow}% nas próximas 3h). ${config.label} exige ${config.requiresDryPeriodAfterHours}h sem chuva após aplicação.`,
      });
      alerts.push(`🌧️ Chuva iminente (${weather.rainProbabilityNow}%): risco de lavagem. Não aplicar.`);
      score -= 40;
    } else if (weather.rainProbability24h > 60 && config.requiresDryPeriodAfterHours >= 6) {
      activeRisks.push({
        risk: 'lavagem',
        severity: 'alto',
        detail: `Chuva provável nas próximas 24h (${weather.rainProbability24h}%). Período seco necessário: ${config.requiresDryPeriodAfterHours}h.`,
      });
      alerts.push(`🌧️ Chuva provável em 24h (${weather.rainProbability24h}%): avaliar janela de aplicação.`);
      score -= 20;
    }
  }

  // --- Incorporação por Chuva (pré-emergente / residual) ---
  if (config.requiresRainWithinHours !== null) {
    if (weather.rainProbability48h < 30) {
      activeRisks.push({
        risk: 'residual_reduzido',
        severity: 'moderado',
        detail: `Baixa probabilidade de chuva nas próximas 48h (${weather.rainProbability48h}%). ${config.label} precisa de incorporação.`,
      });
      alerts.push(`☀️ Sem chuva prevista (${weather.rainProbability48h}% em 48h): incorporação do pré-emergente comprometida.`);
      score -= 15;
    } else if (weather.rainProbabilityNow > 70 && weather.rainMmForecast3h > config.washRiskRainMm) {
      activeRisks.push({
        risk: 'lavagem',
        severity: 'alto',
        detail: `Chuva intensa prevista (${weather.rainMmForecast3h}mm/3h). Pode lavar produto antes da incorporação.`,
      });
      alerts.push(`⛈️ Chuva intensa (${weather.rainMmForecast3h}mm): risco de lavagem do produto.`);
      score -= 25;
    }
  }

  // --- Solo arenoso: reduz residual ---
  if (soilTexture === 'arenoso' && (profile === 'herbicida_pre_emergente' || profile === 'residual')) {
    activeRisks.push({
      risk: 'residual_reduzido',
      severity: 'baixo',
      detail: 'Solo arenoso: persistência do residual reduzida. Monitorar reinfestação.',
    });
    score -= 5;
  }

  // --- Inoculação: UV e temperatura ---
  if (profile === 'inoculacao') {
    if (weather.uvIndex && weather.uvIndex > 6) {
      activeRisks.push({
        risk: 'sobrevivencia_biologica',
        severity: 'alto',
        detail: `UV elevado (${weather.uvIndex}): risco de morte dos microrganismos. Aplicar ao anoitecer ou madrugada.`,
      });
      alerts.push(`☀️ UV elevado (${weather.uvIndex}): inoculante sensível. Aplicar em horário protegido.`);
      score -= 30;
    }
    if (weather.temperature > 28) {
      activeRisks.push({
        risk: 'sobrevivencia_biologica',
        severity: 'moderado',
        detail: `Temperatura ${weather.temperature}°C: sobrevivência do inoculante reduzida acima de 28°C.`,
      });
      score -= 15;
    }
  }

  // --- Herbicida sistêmico / dessecação: planta em estresse hídrico ---
  if (profile === 'herbicida_sistemico' || profile === 'dessecacao') {
    if (weather.humidity < 40) {
      activeRisks.push({
        risk: 'translocacao_reduzida',
        severity: 'alto',
        detail: `UR ${weather.humidity}%: planta em provável estresse hídrico. Translocação comprometida.`,
      });
      alerts.push(`🌿 Estresse hídrico provável (UR ${weather.humidity}%): translocação do sistêmico reduzida.`);
      score -= 25;
    }
  }

  // Normalizar score
  score = Math.max(0, Math.min(100, score));

  // Determinar recomendação
  let recommendation: ProfileAnalysisResult['recommendation'];
  let recommendation_reason: string;

  if (score >= 75) {
    recommendation = 'recomendado';
    recommendation_reason = `Condições favoráveis para ${config.label} (score ${score}/100).`;
  } else if (score >= 50) {
    recommendation = 'aceitavel';
    recommendation_reason = `Condições aceitáveis para ${config.label} com cautela (score ${score}/100).`;
  } else if (score >= 25) {
    recommendation = 'aguardar';
    recommendation_reason = `Condições marginais para ${config.label}. Aguardar melhora climática (score ${score}/100).`;
  } else {
    recommendation = 'nao-recomendado';
    recommendation_reason = `Condições desfavoráveis para ${config.label}. Não aplicar (score ${score}/100).`;
  }

  return {
    profile,
    profileLabel: config.label,
    recommendation,
    score,
    deltaT,
    deltaTStatus,
    activeRisks,
    operationalAlerts: alerts,
    recommendation_reason,
    isOperationalWindow: score >= 75,
  };
}

/**
 * Analisa condições para todos os perfis relevantes no período sazonal atual.
 * Retorna apenas os perfis dominantes para a época, evitando spam.
 */
export function analyzeSeasonalProfiles(
  weather: WeatherSnapshot,
  soilTexture: 'arenoso' | 'medio' | 'argiloso' = 'medio',
  month?: number
): {
  seasonalContext: SeasonalContext;
  profileResults: ProfileAnalysisResult[];
  overallRecommendation: 'operar' | 'cautela' | 'aguardar' | 'encerrado';
  summary: string;
} {
  const currentMonth = month ?? new Date().getMonth() + 1;
  const seasonalContext = getCurrentSeasonalPeriod(currentMonth);

  // Entressafra: não gerar análise operacional
  if (seasonalContext.period === 'entressafra') {
    return {
      seasonalContext,
      profileResults: [],
      overallRecommendation: 'encerrado',
      summary: 'Entressafra: alertas climáticos operacionais encerrados. Monitoramento de mercado ativo.',
    };
  }

  // Analisar apenas perfis dominantes da época
  const profileResults = seasonalContext.dominantProfiles.map((profileType) =>
    analyzeProfileConditions(profileType, weather, soilTexture)
  );

  // Determinar recomendação geral
  const scores = profileResults.map((r) => r.score);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const hasRecommended = profileResults.some((r) => r.recommendation === 'recomendado');
  const allNotRecommended = profileResults.every((r) => r.recommendation === 'nao-recomendado');

  let overallRecommendation: 'operar' | 'cautela' | 'aguardar' | 'encerrado';
  if (allNotRecommended || avgScore < 30) {
    overallRecommendation = 'aguardar';
  } else if (hasRecommended && avgScore >= 65) {
    overallRecommendation = 'operar';
  } else {
    overallRecommendation = 'cautela';
  }

  const summary = buildSeasonalSummary(seasonalContext, profileResults, overallRecommendation, weather);

  return { seasonalContext, profileResults, overallRecommendation, summary };
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS
// ---------------------------------------------------------------------------

function buildSeasonalSummary(
  context: SeasonalContext,
  results: ProfileAnalysisResult[],
  overall: string,
  weather: WeatherSnapshot
): string {
  const overallEmoji = overall === 'operar' ? '🟢' : overall === 'cautela' ? '🟡' : '🔴';
  let msg = `${overallEmoji} <b>${context.label.toUpperCase()}</b>\n`;
  msg += `<i>${context.operationalPriority}</i>\n\n`;

  msg += `<b>🌡️ Condições Atuais</b>\n`;
  msg += `• Temp: ${weather.temperature}°C | UR: ${weather.humidity}% | Vento: ${weather.windSpeed} km/h\n`;
  const deltaT = calculateDeltaT(weather.temperature, weather.humidity);
  msg += `• Delta T: ${deltaT.toFixed(1)}°C | Chuva 24h: ${weather.rainProbability24h}%\n\n`;

  if (results.length > 0) {
    msg += `<b>🚜 PERFIS OPERACIONAIS</b>\n`;
    for (const r of results) {
      const emoji = r.recommendation === 'recomendado' ? '🟢' : r.recommendation === 'aceitavel' ? '🟡' : r.recommendation === 'aguardar' ? '🟠' : '🔴';
      msg += `${emoji} <b>${r.profileLabel}</b>: ${r.recommendation.toUpperCase()} (${r.score}/100)\n`;
      if (r.operationalAlerts.length > 0) {
        msg += `   ${r.operationalAlerts[0]}\n`;
      }
    }
    msg += '\n';
  }

  return msg;
}
