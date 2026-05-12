/**
 * AgroIntel Canarana — Fase 5: Agro & Mercado
 * Módulo 1: Base Agronômica + Módulo 2: Motor Climático Agronômico
 *
 * Responsabilidades:
 * - Catálogo técnico das culturas-alvo (Soja, Milho, Sorgo, Milheto, Gergelim)
 * - Janelas de plantio e colheita para o Vale do Araguaia / Canarana-MT
 * - Exigências nutricionais e climáticas para pulverização
 * - Motor de inteligência operacional: Delta T, risco de chuva, janela de aplicação
 * - Bootstrap de culturas padrão por fazenda
 */

import type { InsertCrop } from "../../drizzle/schema";

// ---------------------------------------------------------------------------
// TIPOS INTERNOS
// ---------------------------------------------------------------------------

export interface CropTemplate {
  name: string;
  displayName: string;
  plantingWindowStart: number;
  plantingWindowEnd: number;
  harvestWindowStart: number;
  harvestWindowEnd: number;
  cycleDays: number;
  minTempSpray: number;
  maxTempSpray: number;
  minHumiditySpray: number;
  maxHumiditySpray: number;
  maxWindSpeedSpray: number;
  minDeltaT: number;
  maxDeltaT: number;
  nitrogenKgHa: number;
  phosphorusKgHa: number;
  potassiumKgHa: number;
  sulfurKgHa: number;
  expectedYieldBagHa: number;
  notes: string;
}

export interface WeatherInput {
  temperature: number;   // °C
  humidity: number;      // %
  windSpeed: number;     // km/h
  dewPoint?: number;     // °C (calculado se não fornecido)
  rainProbability?: number; // 0-100
}

export interface AgronomicAnalysis {
  deltaT: number;
  deltaTStatus: "ideal" | "aceitavel" | "critico";
  sprayRecommendation: "recomendado" | "aceitavel" | "nao-recomendado";
  sprayReason: string;
  rainRisk: "baixo" | "moderado" | "alto";
  rainRiskReason: string;
  operationalWindow: {
    isOpen: boolean;
    reason: string;
    score: number; // 0-100
  };
  cropSpecificAlerts: string[];
}

// ---------------------------------------------------------------------------
// CATÁLOGO TÉCNICO DAS CULTURAS-ALVO
// Referência: Embrapa, MAPA, dados regionais do Vale do Araguaia / Canarana-MT
// ---------------------------------------------------------------------------

export const CROP_CATALOG: Record<string, CropTemplate> = {
  soja: {
    name: "soja",
    displayName: "Soja (Glycine max)",
    // Plantio: outubro a dezembro (safra principal Cerrado/MT)
    plantingWindowStart: 10,
    plantingWindowEnd: 12,
    // Colheita: fevereiro a abril
    harvestWindowStart: 2,
    harvestWindowEnd: 4,
    cycleDays: 120, // ciclo médio 110-130 dias
    // Exigências para pulverização (Delta T e condições ideais)
    minTempSpray: 15,
    maxTempSpray: 30,
    minHumiditySpray: 50,
    maxHumiditySpray: 90,
    maxWindSpeedSpray: 15, // km/h
    minDeltaT: 2,
    maxDeltaT: 8,
    // Nutrição: exigência alta em P e K, fixação biológica de N
    nitrogenKgHa: 0,    // FBN (fixação biológica de nitrogênio)
    phosphorusKgHa: 80,
    potassiumKgHa: 90,
    sulfurKgHa: 20,
    expectedYieldBagHa: 58, // sacas/ha (média MT ~58 sc/ha)
    notes:
      "Cultura principal do Cerrado. Fixação biológica de N reduz necessidade de adubação nitrogenada. " +
      "Sensível a déficit hídrico no período R1-R6 (floração e enchimento de grãos). " +
      "Delta T ideal: 2-8°C para pulverização de fungicidas e inseticidas.",
  },

  milho: {
    name: "milho",
    displayName: "Milho (Zea mays)",
    // Plantio: janeiro a fevereiro (safrinha) ou outubro a novembro (safra)
    plantingWindowStart: 1,
    plantingWindowEnd: 2,
    harvestWindowStart: 5,
    harvestWindowEnd: 7,
    cycleDays: 130, // ciclo médio 120-145 dias
    minTempSpray: 15,
    maxTempSpray: 32,
    minHumiditySpray: 45,
    maxHumiditySpray: 90,
    maxWindSpeedSpray: 15,
    minDeltaT: 2,
    maxDeltaT: 8,
    // Alta demanda por N
    nitrogenKgHa: 150,
    phosphorusKgHa: 70,
    potassiumKgHa: 100,
    sulfurKgHa: 15,
    expectedYieldBagHa: 120, // sacas/ha (média safrinha MT ~100-140 sc/ha)
    notes:
      "Safrinha após soja é o sistema predominante no Cerrado. " +
      "Exige parcelamento de N (base + cobertura). " +
      "Sensível a geadas e estresse hídrico no pendoamento (VT-R1). " +
      "Pulverização de fungicidas no VT-R1 é crítica para produtividade.",
  },

  sorgo: {
    name: "sorgo",
    displayName: "Sorgo Granífero (Sorghum bicolor)",
    // Plantio: fevereiro a março (safrinha tolerante à seca)
    plantingWindowStart: 2,
    plantingWindowEnd: 3,
    harvestWindowStart: 6,
    harvestWindowEnd: 8,
    cycleDays: 110, // ciclo médio 100-120 dias
    minTempSpray: 18,
    maxTempSpray: 35,
    minHumiditySpray: 40,
    maxHumiditySpray: 85,
    maxWindSpeedSpray: 15,
    minDeltaT: 2,
    maxDeltaT: 10, // tolera Delta T um pouco mais alto
    nitrogenKgHa: 100,
    phosphorusKgHa: 50,
    potassiumKgHa: 70,
    sulfurKgHa: 10,
    expectedYieldBagHa: 80, // sacas/ha
    notes:
      "Excelente opção de safrinha tolerante à seca. " +
      "Indicado para plantio tardio (fevereiro-março) quando o milho já não é viável. " +
      "Menor exigência hídrica que o milho. " +
      "Cuidado com pulgão-do-colmo e mosca-do-sorgo.",
  },

  milheto: {
    name: "milheto",
    displayName: "Milheto (Pennisetum glaucum)",
    // Plantio: março a abril (cobertura de solo / pastagem de entressafra)
    plantingWindowStart: 3,
    plantingWindowEnd: 4,
    harvestWindowStart: 6,
    harvestWindowEnd: 7,
    cycleDays: 90, // ciclo médio 75-100 dias
    minTempSpray: 20,
    maxTempSpray: 38,
    minHumiditySpray: 35,
    maxHumiditySpray: 85,
    maxWindSpeedSpray: 20, // mais tolerante ao vento
    minDeltaT: 2,
    maxDeltaT: 12,
    nitrogenKgHa: 60,
    phosphorusKgHa: 30,
    potassiumKgHa: 50,
    sulfurKgHa: 8,
    expectedYieldBagHa: 40, // sacas/ha (quando colhido para grão)
    notes:
      "Principalmente usado para cobertura de solo no sistema plantio direto e pastagem de entressafra. " +
      "Alta tolerância ao calor e seca. " +
      "Excelente produção de palhada (>10 t/ha de MS). " +
      "Quando colhido para grão, serve para ração animal.",
  },

  gergelim: {
    name: "gergelim",
    displayName: "Gergelim (Sesamum indicum)",
    // Plantio: novembro a dezembro (cultivo de verão)
    plantingWindowStart: 11,
    plantingWindowEnd: 12,
    harvestWindowStart: 3,
    harvestWindowEnd: 4,
    cycleDays: 100, // ciclo médio 90-110 dias
    minTempSpray: 20,
    maxTempSpray: 32,
    minHumiditySpray: 40,
    maxHumiditySpray: 80, // sensível a umidade excessiva (doenças fúngicas)
    maxWindSpeedSpray: 12,
    minDeltaT: 3,
    maxDeltaT: 8,
    nitrogenKgHa: 40,
    phosphorusKgHa: 40,
    potassiumKgHa: 50,
    sulfurKgHa: 12,
    expectedYieldBagHa: 25, // sacas/ha (600-800 kg/ha)
    notes:
      "Cultura de alto valor agregado para o Cerrado. " +
      "Sensível ao encharcamento e à umidade excessiva (podridão de raiz). " +
      "Não tolera geadas. " +
      "Mercado em expansão para exportação (Japão, Oriente Médio). " +
      "Colheita manual ou semimecanizada; cuidado com deiscência das cápsulas.",
  },
};

// ---------------------------------------------------------------------------
// FUNÇÕES DE BOOTSTRAP
// ---------------------------------------------------------------------------

/**
 * Gera os registros de culturas padrão para uma nova fazenda.
 * Inclui as 5 culturas-alvo do Vale do Araguaia.
 */
export function getDefaultCropsForFarm(farmId: number): InsertCrop[] {
  return Object.values(CROP_CATALOG).map((template) => ({
    farmId,
    name: template.name,
    displayName: template.displayName,
    variety: null,
    plantingWindowStart: template.plantingWindowStart,
    plantingWindowEnd: template.plantingWindowEnd,
    harvestWindowStart: template.harvestWindowStart,
    harvestWindowEnd: template.harvestWindowEnd,
    cycleDays: template.cycleDays,
    minTempSpray: template.minTempSpray.toString(),
    maxTempSpray: template.maxTempSpray.toString(),
    minHumiditySpray: template.minHumiditySpray,
    maxHumiditySpray: template.maxHumiditySpray,
    maxWindSpeedSpray: template.maxWindSpeedSpray.toString(),
    minDeltaT: template.minDeltaT.toString(),
    maxDeltaT: template.maxDeltaT.toString(),
    nitrogenKgHa: template.nitrogenKgHa.toString(),
    phosphorusKgHa: template.phosphorusKgHa.toString(),
    potassiumKgHa: template.potassiumKgHa.toString(),
    sulfurKgHa: template.sulfurKgHa.toString(),
    expectedYieldBagHa: template.expectedYieldBagHa.toString(),
    notes: template.notes,
    isActive: true,
  }));
}

// ---------------------------------------------------------------------------
// MÓDULO 2: MOTOR CLIMÁTICO AGRONÔMICO
// ---------------------------------------------------------------------------

/**
 * Calcula o ponto de orvalho a partir de temperatura e umidade relativa.
 * Fórmula de Magnus simplificada (precisão ±0.4°C para 0-60°C).
 */
export function calculateDewPoint(temperature: number, humidity: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * temperature) / (b + temperature) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

/**
 * Calcula o Delta T (diferença entre temperatura do ar e ponto de orvalho).
 * Delta T é o principal indicador de condições de pulverização.
 *
 * Classificação MAPA/Embrapa:
 * - < 2°C: Inversão térmica, névoa, deriva excessiva → NÃO recomendado
 * - 2-8°C: Condições ideais para pulverização
 * - 8-10°C: Aceitável com cautela
 * - > 10°C: Evaporação excessiva das gotas → NÃO recomendado
 */
export function calculateDeltaT(temperature: number, humidity: number): number {
  const dewPoint = calculateDewPoint(temperature, humidity);
  return parseFloat((temperature - dewPoint).toFixed(2));
}

/**
 * Classifica o Delta T para pulverização.
 */
export function classifyDeltaT(deltaT: number): {
  status: "ideal" | "aceitavel" | "critico";
  label: string;
  description: string;
} {
  if (deltaT >= 2 && deltaT <= 8) {
    return {
      status: "ideal",
      label: "Ideal",
      description: `Delta T ${deltaT.toFixed(1)}°C — condições ideais para pulverização.`,
    };
  } else if (deltaT > 8 && deltaT <= 10) {
    return {
      status: "aceitavel",
      label: "Aceitável",
      description: `Delta T ${deltaT.toFixed(1)}°C — aceitável, mas monitore a evaporação das gotas.`,
    };
  } else if (deltaT < 2) {
    return {
      status: "critico",
      label: "Crítico — Inversão Térmica",
      description: `Delta T ${deltaT.toFixed(1)}°C — risco de inversão térmica e deriva. Não pulverize.`,
    };
  } else {
    return {
      status: "critico",
      label: "Crítico — Evaporação Alta",
      description: `Delta T ${deltaT.toFixed(1)}°C — evaporação excessiva das gotas. Não pulverize.`,
    };
  }
}

/**
 * Avalia o risco de chuva para operações de campo.
 */
export function assessRainRisk(rainProbability: number): {
  risk: "baixo" | "moderado" | "alto";
  label: string;
  reason: string;
} {
  if (rainProbability <= 20) {
    return {
      risk: "baixo",
      label: "Baixo",
      reason: `Probabilidade de chuva: ${rainProbability}%. Condições favoráveis para operações de campo.`,
    };
  } else if (rainProbability <= 50) {
    return {
      risk: "moderado",
      label: "Moderado",
      reason: `Probabilidade de chuva: ${rainProbability}%. Monitore o tempo antes de iniciar pulverizações.`,
    };
  } else {
    return {
      risk: "alto",
      label: "Alto",
      reason: `Probabilidade de chuva: ${rainProbability}%. Evite pulverizações — risco de lavagem do produto.`,
    };
  }
}

/**
 * Analisa as condições climáticas atuais e gera inteligência operacional
 * para uma cultura específica.
 *
 * @param weather - Dados climáticos atuais
 * @param cropName - Nome da cultura (deve existir no CROP_CATALOG)
 * @returns Análise agronômica completa com recomendações operacionais
 */
export function analyzeAgronomicConditions(
  weather: WeatherInput,
  cropName: string
): AgronomicAnalysis {
  const crop = CROP_CATALOG[cropName];
  if (!crop) {
    throw new Error(`Cultura '${cropName}' não encontrada no catálogo agronômico.`);
  }

  const deltaT = calculateDeltaT(weather.temperature, weather.humidity);
  const deltaTClassification = classifyDeltaT(deltaT);
  const rainRisk = assessRainRisk(weather.rainProbability ?? 0);

  const alerts: string[] = [];
  let sprayScore = 100;

  // --- Avaliação de temperatura ---
  if (weather.temperature < crop.minTempSpray) {
    alerts.push(
      `Temperatura ${weather.temperature}°C abaixo do mínimo (${crop.minTempSpray}°C) para ${crop.displayName}.`
    );
    sprayScore -= 30;
  } else if (weather.temperature > crop.maxTempSpray) {
    alerts.push(
      `Temperatura ${weather.temperature}°C acima do máximo (${crop.maxTempSpray}°C) para ${crop.displayName}.`
    );
    sprayScore -= 25;
  }

  // --- Avaliação de umidade ---
  if (weather.humidity < crop.minHumiditySpray) {
    alerts.push(
      `Umidade ${weather.humidity}% abaixo do mínimo (${crop.minHumiditySpray}%) — risco de evaporação prematura.`
    );
    sprayScore -= 20;
  } else if (weather.humidity > crop.maxHumiditySpray) {
    alerts.push(
      `Umidade ${weather.humidity}% acima do máximo (${crop.maxHumiditySpray}%) — risco de deriva e fitotoxidez.`
    );
    sprayScore -= 15;
  }

  // --- Avaliação de vento ---
  if (weather.windSpeed > crop.maxWindSpeedSpray) {
    alerts.push(
      `Velocidade do vento ${weather.windSpeed} km/h acima do máximo (${crop.maxWindSpeedSpray} km/h) — risco de deriva.`
    );
    sprayScore -= 35;
  }

  // --- Avaliação de Delta T ---
  if (deltaTClassification.status === "critico") {
    alerts.push(deltaTClassification.description);
    sprayScore -= 40;
  } else if (deltaTClassification.status === "aceitavel") {
    alerts.push(deltaTClassification.description);
    sprayScore -= 10;
  }

  // --- Avaliação de risco de chuva ---
  if (rainRisk.risk === "alto") {
    alerts.push(rainRisk.reason);
    sprayScore -= 30;
  } else if (rainRisk.risk === "moderado") {
    alerts.push(rainRisk.reason);
    sprayScore -= 10;
  }

  // Normalizar score
  sprayScore = Math.max(0, Math.min(100, sprayScore));

  // Determinar recomendação de pulverização
  let sprayRecommendation: "recomendado" | "aceitavel" | "nao-recomendado";
  let sprayReason: string;

  if (sprayScore >= 70) {
    sprayRecommendation = "recomendado";
    sprayReason = `Condições favoráveis para pulverização de ${crop.displayName} (score: ${sprayScore}/100).`;
  } else if (sprayScore >= 40) {
    sprayRecommendation = "aceitavel";
    sprayReason = `Condições aceitáveis para pulverização de ${crop.displayName} com cautela (score: ${sprayScore}/100).`;
  } else {
    sprayRecommendation = "nao-recomendado";
    sprayReason = `Condições desfavoráveis para pulverização de ${crop.displayName} (score: ${sprayScore}/100). Aguarde melhora.`;
  }

  return {
    deltaT,
    deltaTStatus: deltaTClassification.status,
    sprayRecommendation,
    sprayReason,
    rainRisk: rainRisk.risk,
    rainRiskReason: rainRisk.reason,
    operationalWindow: {
      isOpen: sprayScore >= 70,
      reason: sprayRecommendation === "recomendado" ? sprayReason : alerts[0] ?? sprayReason,
      score: sprayScore,
    },
    cropSpecificAlerts: alerts,
  };
}

/**
 * Analisa condições climáticas para múltiplas culturas simultaneamente.
 * Útil para fazendas com diversificação de culturas.
 */
export function analyzeAllCrops(
  weather: WeatherInput,
  cropNames: string[]
): Record<string, AgronomicAnalysis> {
  const results: Record<string, AgronomicAnalysis> = {};
  for (const cropName of cropNames) {
    if (CROP_CATALOG[cropName]) {
      results[cropName] = analyzeAgronomicConditions(weather, cropName);
    }
  }
  return results;
}

/**
 * Verifica se uma cultura está dentro de sua janela de plantio ou colheita
 * para o mês atual.
 */
export function getCropSeasonStatus(
  cropName: string,
  currentMonth: number
): {
  isPlantingWindow: boolean;
  isHarvestWindow: boolean;
  nextPlantingMonth: number | null;
  label: string;
} {
  const crop = CROP_CATALOG[cropName];
  if (!crop) {
    return {
      isPlantingWindow: false,
      isHarvestWindow: false,
      nextPlantingMonth: null,
      label: "Cultura não encontrada",
    };
  }

  // Verifica janela de plantio (pode cruzar o ano, ex: nov-jan)
  const isPlantingWindow = isInMonthRange(
    currentMonth,
    crop.plantingWindowStart,
    crop.plantingWindowEnd
  );

  const isHarvestWindow = isInMonthRange(
    currentMonth,
    crop.harvestWindowStart,
    crop.harvestWindowEnd
  );

  let nextPlantingMonth: number | null = null;
  if (!isPlantingWindow) {
    nextPlantingMonth = crop.plantingWindowStart;
  }

  let label: string;
  if (isPlantingWindow) {
    label = `Em janela de plantio (${monthName(crop.plantingWindowStart)}–${monthName(crop.plantingWindowEnd)})`;
  } else if (isHarvestWindow) {
    label = `Em janela de colheita (${monthName(crop.harvestWindowStart)}–${monthName(crop.harvestWindowEnd)})`;
  } else {
    label = `Fora de época — próximo plantio: ${monthName(crop.plantingWindowStart)}`;
  }

  return { isPlantingWindow, isHarvestWindow, nextPlantingMonth, label };
}

// ---------------------------------------------------------------------------
// UTILITÁRIOS INTERNOS
// ---------------------------------------------------------------------------

function isInMonthRange(month: number, start: number, end: number): boolean {
  if (start <= end) {
    return month >= start && month <= end;
  }
  // Intervalo que cruza o ano (ex: novembro=11 a janeiro=1)
  return month >= start || month <= end;
}

function monthName(month: number): string {
  const names = [
    "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return names[month] ?? String(month);
}
