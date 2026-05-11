import { logger } from './logger';

export type RiskType = 'drift' | 'volatilization' | 'wash' | 'absorption' | 'thermal_stress';

export interface OperationalRisk {
  type: RiskType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
}

export interface OperationalScore {
  score: number; // 0-100
  classification: 'excelente' | 'boa' | 'moderada' | 'ruim' | 'nao-recomendada';
  risks: OperationalRisk[];
  scoreBreakdown: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    rain: number;
  };
}

/**
 * Analyze operational risks based on weather conditions
 */
export function analyzeOperationalRisks(
  temperature: number,
  humidity: number,
  windSpeed: number,
  rainProbability: number
): OperationalRisk[] {
  const risks: OperationalRisk[] = [];

  // Drift risk (vento forte)
  if (windSpeed > 15) {
    risks.push({
      type: 'drift',
      severity: windSpeed > 20 ? 'critical' : 'high',
      description: `Vento forte (${windSpeed} km/h) aumenta risco de deriva`,
      recommendation: 'Reduzir velocidade de aplicação ou adiar',
    });
  } else if (windSpeed > 10) {
    risks.push({
      type: 'drift',
      severity: 'medium',
      description: `Vento moderado (${windSpeed} km/h) pode causar deriva leve`,
      recommendation: 'Monitorar condições e aplicar com cuidado',
    });
  }

  // Volatilization risk (temperatura alta + umidade baixa)
  if (temperature > 28 && humidity < 50) {
    risks.push({
      type: 'volatilization',
      severity: temperature > 32 ? 'critical' : 'high',
      description: `Temperatura alta (${temperature}°C) e umidade baixa (${humidity}%) favorecem volatilização`,
      recommendation: 'Aplicar em horários mais frescos (madrugada/amanhecer)',
    });
  }

  // Wash risk (chuva)
  if (rainProbability > 50) {
    risks.push({
      type: 'wash',
      severity: rainProbability > 80 ? 'critical' : 'high',
      description: `Alta probabilidade de chuva (${rainProbability}%) pode lavar o defensivo`,
      recommendation: 'Aguardar previsão de tempo melhorar',
    });
  } else if (rainProbability > 30) {
    risks.push({
      type: 'wash',
      severity: 'medium',
      description: `Risco moderado de chuva (${rainProbability}%)`,
      recommendation: 'Considerar condições de risco',
    });
  }

  // Absorption risk (umidade muito alta)
  if (humidity > 90) {
    risks.push({
      type: 'absorption',
      severity: 'medium',
      description: `Umidade muito alta (${humidity}%) pode prejudicar absorção`,
      recommendation: 'Preferir aplicação em umidade 50-80%',
    });
  }

  // Thermal stress risk (temperatura muito alta)
  if (temperature > 30) {
    risks.push({
      type: 'thermal_stress',
      severity: temperature > 35 ? 'critical' : 'high',
      description: `Temperatura muito alta (${temperature}°C) pode causar estresse térmico nas plantas`,
      recommendation: 'Aplicar em horários mais frescos',
    });
  } else if (temperature < 12) {
    risks.push({
      type: 'thermal_stress',
      severity: 'medium',
      description: `Temperatura baixa (${temperature}°C) pode reduzir eficácia`,
      recommendation: 'Aguardar aquecimento',
    });
  }

  logger.log({
    service: 'risk_analysis',
    action: 'analyze',
    level: 'debug',
    status: 'success',
    message: `Identified ${risks.length} operational risks`,
    metadata: { riskCount: risks.length, riskTypes: risks.map((r) => r.type) },
  });

  return risks;
}

/**
 * Calculate operational score based on weather conditions
 */
export function calculateOperationalScore(
  temperature: number,
  humidity: number,
  windSpeed: number,
  rainProbability: number,
  minHumidity: number = 50,
  maxHumidity: number = 90,
  maxTemperature: number = 30,
  maxWindSpeed: number = 15
): OperationalScore {
  let score = 100;
  const breakdown = {
    temperature: 0,
    humidity: 0,
    windSpeed: 0,
    rain: 0,
  };

  // Temperature scoring (0-25 points)
  if (temperature >= 15 && temperature <= maxTemperature) {
    breakdown.temperature = 25;
  } else if (temperature >= 12 && temperature < 15) {
    breakdown.temperature = 15;
  } else if (temperature > maxTemperature && temperature <= 32) {
    breakdown.temperature = 10;
  } else if (temperature > 32) {
    breakdown.temperature = 0;
  } else {
    breakdown.temperature = 5;
  }

  // Humidity scoring (0-25 points)
  if (humidity >= minHumidity && humidity <= maxHumidity) {
    breakdown.humidity = 25;
  } else if (humidity >= 40 && humidity < minHumidity) {
    breakdown.humidity = 15;
  } else if (humidity > maxHumidity && humidity <= 95) {
    breakdown.humidity = 15;
  } else if (humidity > 95 || humidity < 30) {
    breakdown.humidity = 0;
  }

  // Wind speed scoring (0-25 points)
  if (windSpeed <= 5) {
    breakdown.windSpeed = 25;
  } else if (windSpeed <= maxWindSpeed) {
    breakdown.windSpeed = 20;
  } else if (windSpeed <= 20) {
    breakdown.windSpeed = 10;
  } else {
    breakdown.windSpeed = 0;
  }

  // Rain probability scoring (0-25 points)
  if (rainProbability <= 10) {
    breakdown.rain = 25;
  } else if (rainProbability <= 20) {
    breakdown.rain = 20;
  } else if (rainProbability <= 40) {
    breakdown.rain = 10;
  } else if (rainProbability <= 60) {
    breakdown.rain = 5;
  } else {
    breakdown.rain = 0;
  }

  score = breakdown.temperature + breakdown.humidity + breakdown.windSpeed + breakdown.rain;

  // Determine classification
  let classification: 'excelente' | 'boa' | 'moderada' | 'ruim' | 'nao-recomendada';
  if (score >= 85) classification = 'excelente';
  else if (score >= 70) classification = 'boa';
  else if (score >= 50) classification = 'moderada';
  else if (score >= 30) classification = 'ruim';
  else classification = 'nao-recomendada';

  // Analyze risks
  const risks = analyzeOperationalRisks(temperature, humidity, windSpeed, rainProbability);

  return {
    score,
    classification,
    risks,
    scoreBreakdown: breakdown,
  };
}

/**
 * Get risk severity color for UI
 */
export function getRiskSeverityColor(severity: string): string {
  switch (severity) {
    case 'low':
      return '#10b981'; // green
    case 'medium':
      return '#f59e0b'; // amber
    case 'high':
      return '#ef4444'; // red
    case 'critical':
      return '#7c2d12'; // dark red
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Get classification color for UI
 */
export function getClassificationColor(classification: string): string {
  switch (classification) {
    case 'excelente':
      return '#10b981'; // green
    case 'boa':
      return '#84cc16'; // lime
    case 'moderada':
      return '#f59e0b'; // amber
    case 'ruim':
      return '#ef4444'; // red
    case 'nao-recomendada':
      return '#7c2d12'; // dark red
    default:
      return '#6b7280'; // gray
  }
}
