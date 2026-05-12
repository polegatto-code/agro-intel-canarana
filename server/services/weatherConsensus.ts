/**
 * AgroIntel Canarana — Fase 7: Consenso Climático Multi-API
 *
 * Arquitetura preparada para múltiplas fontes climáticas:
 * - OpenWeatherMap (implementado)
 * - WeatherAPI (stub — pronto para integração)
 * - Meteostat (stub — pronto para integração)
 * - NOAA (stub — pronto para integração)
 * - ECMWF (stub — pronto para integração)
 * - INMET (stub — pronto para integração)
 *
 * Objetivos:
 * - Consenso climático por média ponderada de confiança
 * - Score de confiança por fonte
 * - Fallback automático quando fonte falha
 * - Comparação de previsões entre fontes
 * - Base para calibração regional futura
 *
 * NÃO implementa todas as APIs agora.
 * Prepara a estrutura arquitetural para expansão incremental.
 */

import { logger } from './logger';

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export type WeatherApiSource =
  | 'openweathermap'
  | 'weatherapi'
  | 'meteostat'
  | 'noaa'
  | 'ecmwf'
  | 'inmet';

export interface WeatherApiReading {
  source: WeatherApiSource;
  timestamp: Date;
  latitude: number;
  longitude: number;
  temperature: number;         // °C
  humidity: number;            // %
  windSpeed: number;           // km/h
  windDirection?: number;      // graus
  rainProbabilityNow: number;  // % próximas 3h
  rainProbability24h: number;  // % próximas 24h
  rainProbability48h: number;  // % próximas 48h
  rainMmForecast3h: number;    // mm previstos nas próximas 3h
  rainMmForecast24h: number;   // mm previstos nas próximas 24h
  uvIndex?: number;
  pressureMb?: number;
  visibilityKm?: number;
  confidenceScore: number;     // 0-100: confiança desta leitura
  isFromCache: boolean;
  isMock: boolean;
}

export interface ConsensusWeatherReading {
  timestamp: Date;
  latitude: number;
  longitude: number;
  // Valores consensuados (média ponderada por confiança)
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainProbabilityNow: number;
  rainProbability24h: number;
  rainProbability48h: number;
  rainMmForecast3h: number;
  rainMmForecast24h: number;
  uvIndex?: number;
  // Metadados de consenso
  overallConfidence: number;   // 0-100: confiança geral do consenso
  sourcesUsed: WeatherApiSource[];
  sourcesFailed: WeatherApiSource[];
  divergenceLevel: 'baixo' | 'moderado' | 'alto'; // divergência entre fontes
  divergenceDetails?: string;
  isFallback: boolean;         // true se apenas 1 fonte disponível
}

export interface WeatherApiProviderConfig {
  source: WeatherApiSource;
  label: string;
  isEnabled: boolean;
  isImplemented: boolean;
  baseWeight: number;          // 0-1: peso base na média ponderada
  apiKeyEnvVar: string | null; // variável de ambiente com a chave
  notes: string;
}

// ---------------------------------------------------------------------------
// REGISTRO DE PROVEDORES
// ---------------------------------------------------------------------------

export const WEATHER_API_PROVIDERS: Record<WeatherApiSource, WeatherApiProviderConfig> = {
  openweathermap: {
    source: 'openweathermap',
    label: 'OpenWeatherMap',
    isEnabled: true,
    isImplemented: true,
    baseWeight: 0.9,
    apiKeyEnvVar: 'OPENWEATHER_API_KEY',
    notes: 'Provedor principal. Dados globais com boa cobertura regional para MT.',
  },
  weatherapi: {
    source: 'weatherapi',
    label: 'WeatherAPI',
    isEnabled: false,
    isImplemented: false,
    baseWeight: 0.85,
    apiKeyEnvVar: 'WEATHERAPI_KEY',
    notes: 'Stub pronto para integração. Boa resolução para previsão de 3 dias.',
  },
  meteostat: {
    source: 'meteostat',
    label: 'Meteostat',
    isEnabled: false,
    isImplemented: false,
    baseWeight: 0.7,
    apiKeyEnvVar: 'METEOSTAT_KEY',
    notes: 'Stub pronto para integração. Especializado em dados históricos e estações.',
  },
  noaa: {
    source: 'noaa',
    label: 'NOAA',
    isEnabled: false,
    isImplemented: false,
    baseWeight: 0.8,
    apiKeyEnvVar: null,
    notes: 'Stub pronto para integração. Dados abertos de alta qualidade.',
  },
  ecmwf: {
    source: 'ecmwf',
    label: 'ECMWF',
    isEnabled: false,
    isImplemented: false,
    baseWeight: 0.95,
    apiKeyEnvVar: 'ECMWF_KEY',
    notes: 'Stub pronto para integração. Modelo europeu de alta precisão para previsão.',
  },
  inmet: {
    source: 'inmet',
    label: 'INMET',
    isEnabled: false,
    isImplemented: false,
    baseWeight: 0.85,
    apiKeyEnvVar: null,
    notes: 'Stub pronto para integração. Dados nacionais do Instituto Nacional de Meteorologia.',
  },
};

// ---------------------------------------------------------------------------
// ADAPTADORES DE FONTE (STUBS PARA EXPANSÃO FUTURA)
// ---------------------------------------------------------------------------

/**
 * Interface base que todos os adaptadores de API climática devem implementar.
 */
export interface IWeatherApiAdapter {
  source: WeatherApiSource;
  fetchWeather(latitude: number, longitude: number): Promise<WeatherApiReading>;
  isAvailable(): boolean;
}

/**
 * Adaptador para OpenWeatherMap (usa o serviço existente como base).
 * Converte os dados do formato interno para o formato consensual.
 */
export class OpenWeatherMapAdapter implements IWeatherApiAdapter {
  source: WeatherApiSource = 'openweathermap';

  async fetchWeather(latitude: number, longitude: number): Promise<WeatherApiReading> {
    // Importação dinâmica para evitar dependência circular
    const { openWeatherService } = await import('./openweather');
    const current = await openWeatherService.getCurrentWeather(latitude, longitude);
    const forecast = await openWeatherService.getHourlyForecast(24, latitude, longitude);

    // Calcular probabilidade de chuva nas próximas 3h, 24h e 48h
    const next3h = forecast.slice(0, 1);
    const next24h = forecast.slice(0, 8);
    const next48h = forecast.slice(0, 16);

    const rainProb3h = next3h.length > 0 ? Math.max(...next3h.map((f) => f.rainProbability)) : 0;
    const rainProb24h = next24h.length > 0 ? Math.max(...next24h.map((f) => f.rainProbability)) : 0;
    const rainProb48h = next48h.length > 0 ? Math.max(...next48h.map((f) => f.rainProbability)) : 0;
    // HourlyForecast não tem campo de mm — estimativa baseada em probabilidade
    const rainMm3h = rainProb3h > 70 ? 5 : rainProb3h > 40 ? 2 : 0;
    const rainMm24h = rainProb24h > 70 ? 15 : rainProb24h > 40 ? 5 : 0;

    return {
      source: 'openweathermap',
      timestamp: new Date(),
      latitude,
      longitude,
      temperature: current.temperature,
      humidity: current.humidity,
      windSpeed: current.windSpeed,
      windDirection: undefined, // WeatherData não expõe windDirection
      rainProbabilityNow: rainProb3h,
      rainProbability24h: rainProb24h,
      rainProbability48h: rainProb48h,
      rainMmForecast3h: rainMm3h,
      rainMmForecast24h: rainMm24h,
      uvIndex: undefined, // WeatherData não expõe uvIndex
      pressureMb: undefined, // WeatherData não expõe pressure
      confidenceScore: 85, // OpenWeatherMap: confiança base alta
      isFromCache: false,
      isMock: false,
    };
  }

  isAvailable(): boolean {
    return !!process.env.OPENWEATHER_API_KEY;
  }
}

/**
 * Stub genérico para provedores ainda não implementados.
 * Lança erro para indicar que o provedor não está disponível.
 */
export class WeatherApiStubAdapter implements IWeatherApiAdapter {
  constructor(public source: WeatherApiSource) {}

  async fetchWeather(_latitude: number, _longitude: number): Promise<WeatherApiReading> {
    throw new Error(`Provider '${this.source}' is not yet implemented. Stub only.`);
  }

  isAvailable(): boolean {
    return false;
  }
}

// ---------------------------------------------------------------------------
// MOTOR DE CONSENSO
// ---------------------------------------------------------------------------

export class WeatherConsensusEngine {
  private adapters: Map<WeatherApiSource, IWeatherApiAdapter> = new Map();

  constructor() {
    // Registrar adaptadores disponíveis
    this.adapters.set('openweathermap', new OpenWeatherMapAdapter());

    // Registrar stubs para provedores futuros
    const stubs: WeatherApiSource[] = ['weatherapi', 'meteostat', 'noaa', 'ecmwf', 'inmet'];
    for (const source of stubs) {
      this.adapters.set(source, new WeatherApiStubAdapter(source));
    }
  }

  /**
   * Coleta dados de todas as fontes habilitadas e implementadas.
   * Retorna leituras individuais e o consenso ponderado.
   */
  async fetchConsensus(
    latitude: number,
    longitude: number
  ): Promise<ConsensusWeatherReading> {
    const readings: WeatherApiReading[] = [];
    const failed: WeatherApiSource[] = [];

    // Coletar de todas as fontes habilitadas e implementadas
    for (const [source, config] of Object.entries(WEATHER_API_PROVIDERS)) {
      if (!config.isEnabled || !config.isImplemented) continue;

      const adapter = this.adapters.get(source as WeatherApiSource);
      if (!adapter || !adapter.isAvailable()) {
        failed.push(source as WeatherApiSource);
        continue;
      }

      try {
        const reading = await adapter.fetchWeather(latitude, longitude);
        readings.push(reading);
        logger.log({
          service: 'weather_consensus',
          action: 'fetch',
          level: 'info',
          status: 'success',
          message: `Weather data fetched from ${source}`,
          metadata: { source, confidence: reading.confidenceScore },
        });
      } catch (err) {
        failed.push(source as WeatherApiSource);
        logger.log({
          service: 'weather_consensus',
          action: 'fetch',
          level: 'warn',
          status: 'failed',
          message: `Failed to fetch from ${source}: ${err instanceof Error ? err.message : String(err)}`,
          metadata: { source },
        });
      }
    }

    // Se nenhuma fonte disponível, erro crítico
    if (readings.length === 0) {
      throw new Error('No weather data sources available. All providers failed or are disabled.');
    }

    return this.buildConsensus(readings, failed, latitude, longitude);
  }

  /**
   * Constrói o consenso climático a partir das leituras individuais.
   * Usa média ponderada pelo score de confiança de cada fonte.
   */
  private buildConsensus(
    readings: WeatherApiReading[],
    failed: WeatherApiSource[],
    latitude: number,
    longitude: number
  ): ConsensusWeatherReading {
    const totalWeight = readings.reduce((sum, r) => sum + r.confidenceScore, 0);

    const weighted = <T extends keyof WeatherApiReading>(field: T): number => {
      return readings.reduce((sum, r) => {
        const val = r[field];
        return sum + (typeof val === 'number' ? val * r.confidenceScore : 0);
      }, 0) / totalWeight;
    };

    const temperature = weighted('temperature');
    const humidity = weighted('humidity');
    const windSpeed = weighted('windSpeed');
    const rainProbabilityNow = weighted('rainProbabilityNow');
    const rainProbability24h = weighted('rainProbability24h');
    const rainProbability48h = weighted('rainProbability48h');
    const rainMmForecast3h = weighted('rainMmForecast3h');
    const rainMmForecast24h = weighted('rainMmForecast24h');

    // Score de confiança geral: média ponderada
    const overallConfidence = readings.reduce((sum, r) => sum + r.confidenceScore, 0) / readings.length;

    // Calcular divergência entre fontes
    const { divergenceLevel, divergenceDetails } = this.calculateDivergence(readings);

    // UV: média simples dos disponíveis
    const uvReadings = readings.filter((r) => r.uvIndex !== undefined);
    const uvIndex = uvReadings.length > 0
      ? uvReadings.reduce((sum, r) => sum + (r.uvIndex ?? 0), 0) / uvReadings.length
      : undefined;

    return {
      timestamp: new Date(),
      latitude,
      longitude,
      temperature: parseFloat(temperature.toFixed(1)),
      humidity: Math.round(humidity),
      windSpeed: parseFloat(windSpeed.toFixed(1)),
      rainProbabilityNow: Math.round(rainProbabilityNow),
      rainProbability24h: Math.round(rainProbability24h),
      rainProbability48h: Math.round(rainProbability48h),
      rainMmForecast3h: parseFloat(rainMmForecast3h.toFixed(1)),
      rainMmForecast24h: parseFloat(rainMmForecast24h.toFixed(1)),
      uvIndex: uvIndex !== undefined ? parseFloat(uvIndex.toFixed(1)) : undefined,
      overallConfidence: Math.round(overallConfidence),
      sourcesUsed: readings.map((r) => r.source),
      sourcesFailed: failed,
      divergenceLevel,
      divergenceDetails,
      isFallback: readings.length === 1,
    };
  }

  /**
   * Calcula o nível de divergência entre as leituras das diferentes fontes.
   */
  private calculateDivergence(readings: WeatherApiReading[]): {
    divergenceLevel: 'baixo' | 'moderado' | 'alto';
    divergenceDetails?: string;
  } {
    if (readings.length < 2) {
      return { divergenceLevel: 'baixo', divergenceDetails: 'Apenas uma fonte disponível.' };
    }

    const temps = readings.map((r) => r.temperature);
    const humidities = readings.map((r) => r.humidity);
    const winds = readings.map((r) => r.windSpeed);
    const rains = readings.map((r) => r.rainProbability24h);

    const tempRange = Math.max(...temps) - Math.min(...temps);
    const humidityRange = Math.max(...humidities) - Math.min(...humidities);
    const windRange = Math.max(...winds) - Math.min(...winds);
    const rainRange = Math.max(...rains) - Math.min(...rains);

    const divergenceScore =
      (tempRange > 3 ? 2 : tempRange > 1.5 ? 1 : 0) +
      (humidityRange > 15 ? 2 : humidityRange > 8 ? 1 : 0) +
      (windRange > 8 ? 2 : windRange > 4 ? 1 : 0) +
      (rainRange > 30 ? 2 : rainRange > 15 ? 1 : 0);

    if (divergenceScore >= 5) {
      return {
        divergenceLevel: 'alto',
        divergenceDetails: `Alta divergência: temp ±${tempRange.toFixed(1)}°C, UR ±${humidityRange.toFixed(0)}%, vento ±${windRange.toFixed(1)} km/h, chuva ±${rainRange.toFixed(0)}%.`,
      };
    } else if (divergenceScore >= 2) {
      return {
        divergenceLevel: 'moderado',
        divergenceDetails: `Divergência moderada entre fontes. Consenso calculado por média ponderada.`,
      };
    } else {
      return { divergenceLevel: 'baixo' };
    }
  }

  /**
   * Retorna o status de todos os provedores configurados.
   */
  getProvidersStatus(): {
    source: WeatherApiSource;
    label: string;
    isEnabled: boolean;
    isImplemented: boolean;
    isAvailable: boolean;
  }[] {
    return Object.values(WEATHER_API_PROVIDERS).map((config) => {
      const adapter = this.adapters.get(config.source);
      return {
        source: config.source,
        label: config.label,
        isEnabled: config.isEnabled,
        isImplemented: config.isImplemented,
        isAvailable: adapter?.isAvailable() ?? false,
      };
    });
  }
}

export const weatherConsensusEngine = new WeatherConsensusEngine();
