import { logger } from './logger';
import * as db from '../db';

// Rate limit tracking for OpenWeatherMap API
const apiCallTimestamps: Map<number, number[]> = new Map();
const RATE_LIMIT_CALLS = 60; // 60 calls per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export type OperationalClassification = 'excelente' | 'boa' | 'moderada' | 'ruim' | 'nao-recomendada';

export interface WeatherForecast {
  hour: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  isRecommended: boolean;
  classification: OperationalClassification;
}

export interface WeatherAnalysis {
  currentTemp: number;
  currentHumidity: number;
  currentWindSpeed: number;
  hourlyForecast: WeatherForecast[];
  applicationWindowStart?: number;
  applicationWindowEnd?: number;
  isApplicationRecommended: boolean;
  overallClassification: OperationalClassification;
  score: number; // 0-100
  notes: string[];
}

/**
 * Classify a specific hour based on climate parameters
 */
function classifyHour(
  temperature: number,
  humidity: number,
  windSpeed: number,
  rainProbability: number,
  minHumidity: number = 50,
  maxHumidity: number = 90,
  maxTemperature: number = 30,
  maxWindSpeed: number = 15
): OperationalClassification {
  let score = 100;
  const issues: string[] = [];

  // Temperature check
  if (temperature > maxTemperature) {
    score -= 30;
    issues.push('Temperatura alta');
  } else if (temperature < 15) {
    score -= 20;
    issues.push('Temperatura baixa');
  }

  // Humidity check
  if (humidity < minHumidity) {
    score -= 25;
    issues.push('Umidade baixa');
  } else if (humidity > maxHumidity) {
    score -= 15;
    issues.push('Umidade alta');
  }

  // Wind check
  if (windSpeed > maxWindSpeed) {
    score -= 30;
    issues.push('Vento forte');
  }

  // Rain check
  if (rainProbability > 50) {
    score -= 40;
    issues.push('Probabilidade de chuva alta');
  } else if (rainProbability > 20) {
    score -= 15;
    issues.push('Risco de chuva');
  }

  // Classify based on score
  if (score >= 85) return 'excelente';
  if (score >= 70) return 'boa';
  if (score >= 50) return 'moderada';
  if (score >= 30) return 'ruim';
  return 'nao-recomendada';
}

/**
 * Find the best application window in the forecast
 */
function findApplicationWindow(
  forecast: WeatherForecast[]
): { start?: number; end?: number; found: boolean } {
  const excellentHours = forecast.filter((h) => h.classification === 'excelente');
  const goodHours = forecast.filter((h) => h.classification === 'boa');
  const applicableHours = [...excellentHours, ...goodHours];

  if (applicableHours.length === 0) {
    return { found: false };
  }

  // Find consecutive block of good hours
  let bestStart = applicableHours[0].hour;
  let bestEnd = applicableHours[0].hour;
  let currentStart = applicableHours[0].hour;
  let currentEnd = applicableHours[0].hour;
  let bestLength = 1;

  for (let i = 1; i < applicableHours.length; i++) {
    if (applicableHours[i].hour === currentEnd + 1) {
      currentEnd = applicableHours[i].hour;
    } else {
      const length = currentEnd - currentStart + 1;
      if (length > bestLength) {
        bestLength = length;
        bestStart = currentStart;
        bestEnd = currentEnd;
      }
      currentStart = applicableHours[i].hour;
      currentEnd = applicableHours[i].hour;
    }
  }

  const length = currentEnd - currentStart + 1;
  if (length > bestLength) {
    bestStart = currentStart;
    bestEnd = currentEnd;
  }

  return { start: bestStart, end: bestEnd, found: true };
}

/**
 * Check if API call is allowed (rate limit protection)
 */
function isApiCallAllowed(farmId: number): boolean {
  const now = Date.now();
  const timestamps = apiCallTimestamps.get(farmId) || [];
  
  // Remove timestamps outside the window
  const validTimestamps = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= RATE_LIMIT_CALLS) {
    logger.log({
      service: 'weather',
      action: 'rate_limit',
      level: 'warn',
      status: 'pending',
      farmId,
      message: `Rate limit reached for farm ${farmId}`,
      metadata: { callsInWindow: validTimestamps.length }
    });
    return false;
  }
  
  // Record this call
  validTimestamps.push(now);
  apiCallTimestamps.set(farmId, validTimestamps);
  
  return true;
}

/**
 * Fetch weather data from OpenWeatherMap API
 */
async function fetchWeatherFromAPI(
  latitude: number = -7.5,
  longitude: number = -51.5,
  apiKey?: string,
  farmId: number = 0
): Promise<any> {
  // Check rate limit before making API call
  if (!isApiCallAllowed(farmId)) {
    logger.log({
      service: 'weather',
      action: 'fetch_api',
      level: 'warn',
      status: 'pending',
      farmId,
      message: 'Rate limit exceeded, using cached or mock data',
    });
    return generateMockWeatherData();
  }

  // Default coordinates for Canarana-MT
  if (!apiKey) {
    logger.log({
      service: 'weather',
      action: 'fetch_api',
      level: 'warn',
      status: 'failed',
      message: 'No OpenWeatherMap API key provided, using mock data',
    });

    // Return mock data for development
    return generateMockWeatherData();
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.log({
      service: 'weather',
      action: 'fetch_api',
      level: 'error',
      status: 'failed',
      message: 'Failed to fetch weather from OpenWeatherMap',
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to mock data
    return generateMockWeatherData();
  }
}

/**
 * Generate mock weather data for development/testing
 */
function generateMockWeatherData(): any {
  const now = new Date();
  const list = [];

  for (let i = 0; i < 40; i++) {
    const forecastTime = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);
    const hour = forecastTime.getHours();

    // Simulate realistic weather patterns
    let temp = 20 + Math.sin(hour / 24) * 10 + Math.random() * 3;
    let humidity = 60 + Math.cos(hour / 24) * 20 + Math.random() * 10;
    let windSpeed = 5 + Math.random() * 8;
    let rainProb = Math.random() * 30;

    // Morning hours tend to be better
    if (hour >= 5 && hour <= 10) {
      humidity = Math.min(humidity + 10, 95);
      windSpeed = Math.max(windSpeed - 2, 0);
      rainProb = Math.max(rainProb - 10, 0);
    }

    list.push({
      dt: Math.floor(forecastTime.getTime() / 1000),
      main: {
        temp,
        humidity,
      },
      wind: {
        speed: windSpeed,
      },
      clouds: {
        all: rainProb,
      },
    });
  }

  return { list };
}

/**
 * Parse OpenWeatherMap data into hourly forecast
 */
function parseWeatherData(
  data: any,
  minHumidity: number,
  maxHumidity: number,
  maxTemperature: number,
  maxWindSpeed: number
): WeatherForecast[] {
  const forecast: WeatherForecast[] = [];
  const seen = new Set<number>();

  for (const item of data.list) {
    const date = new Date(item.dt * 1000);
    const hour = date.getHours();

    // Skip if we already have this hour
    if (seen.has(hour)) continue;
    seen.add(hour);

    const temp = Math.round(item.main.temp * 10) / 10;
    const humidity = item.main.humidity;
    const windSpeed = Math.round(item.wind.speed * 10) / 10;
    const rainProb = item.clouds?.all || 0;

    const classification = classifyHour(
      temp,
      humidity,
      windSpeed,
      rainProb,
      minHumidity,
      maxHumidity,
      maxTemperature,
      maxWindSpeed
    );

    forecast.push({
      hour,
      temperature: temp,
      humidity,
      windSpeed,
      rainProbability: rainProb,
      isRecommended: classification === 'excelente' || classification === 'boa',
      classification,
    });
  }

  return forecast.sort((a, b) => a.hour - b.hour);
}

/**
 * Analyze weather data and generate recommendations
 */
export async function analyzeWeather(
  userId: number,
  minHumidity: number = 50,
  maxHumidity: number = 90,
  maxTemperature: number = 30,
  maxWindSpeed: number = 15,
  apiKey?: string,
  latitude: number = -7.5,
  longitude: number = -51.5,
  farmId: number = 0
): Promise<WeatherAnalysis> {
  logger.log({
    service: 'weather',
    action: 'analyze',
    level: 'info',
    status: 'pending',
    userId,
    message: 'Starting weather analysis',
  });

  try {
    // Fetch weather data
    const weatherData = await fetchWeatherFromAPI(latitude, longitude, apiKey, farmId);

    // Parse into hourly forecast
    const hourlyForecast = parseWeatherData(
      weatherData,
      minHumidity,
      maxHumidity,
      maxTemperature,
      maxWindSpeed
    );

    if (hourlyForecast.length === 0) {
      throw new Error('No forecast data available');
    }

    // Get current conditions (first hour)
    const current = hourlyForecast[0];

    // Find application window
    const window = findApplicationWindow(hourlyForecast);

    // Calculate overall classification
    const excellentCount = hourlyForecast.filter((h) => h.classification === 'excelente').length;
    const goodCount = hourlyForecast.filter((h) => h.classification === 'boa').length;
    const moderateCount = hourlyForecast.filter((h) => h.classification === 'moderada').length;

    let overallClassification: OperationalClassification;
    if (excellentCount >= 3) overallClassification = 'excelente';
    else if (excellentCount + goodCount >= 5) overallClassification = 'boa';
    else if (excellentCount + goodCount + moderateCount >= 8) overallClassification = 'moderada';
    else overallClassification = 'ruim';

    // Calculate score
    const score = Math.round(
      (excellentCount * 100 + goodCount * 75 + moderateCount * 50) / hourlyForecast.length
    );

    // Generate notes
    const notes: string[] = [];
    if (window.found) {
      notes.push(`Melhor janela: ${window.start}:00 às ${window.end}:00`);
    } else {
      notes.push('Nenhuma janela ideal encontrada hoje');
    }

    if (current.humidity < minHumidity) {
      notes.push(`Umidade abaixo do ideal (${current.humidity}%)`);
    }
    if (current.temperature > maxTemperature) {
      notes.push(`Temperatura acima do ideal (${current.temperature}°C)`);
    }
    if (current.windSpeed > maxWindSpeed) {
      notes.push(`Vento acima do ideal (${current.windSpeed} km/h)`);
    }

    const analysis: WeatherAnalysis = {
      currentTemp: current.temperature,
      currentHumidity: current.humidity,
      currentWindSpeed: current.windSpeed,
      hourlyForecast,
      applicationWindowStart: window.start ?? undefined,
      applicationWindowEnd: window.end ?? undefined,
      isApplicationRecommended: window.found,
      overallClassification,
      score,
      notes,
    };

    logger.log({
      service: 'weather',
      action: 'analyze',
      level: 'info',
      status: 'success',
      userId,
      message: `Weather analysis complete. Classification: ${overallClassification}`,
      metadata: { score, windowFound: window.found },
    });

    return analysis;
  } catch (error) {
    logger.log({
      service: 'weather',
      action: 'analyze',
      level: 'error',
      status: 'failed',
      userId,
      message: 'Weather analysis failed',
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Save weather analysis to database
 */
export async function saveWeatherAnalysis(
  userId: number,
  analysis: WeatherAnalysis,
  farmId?: number
): Promise<void> {
  try {
    // Save hourly log
    await db.createWeatherLog({
      userId,
      farmId: farmId || 0,
      temperature: analysis.currentTemp.toString() as any,
      humidity: analysis.currentHumidity,
      windSpeed: analysis.currentWindSpeed.toString() as any,
      hourlyForecast: analysis.hourlyForecast,
      applicationWindowStart: analysis.applicationWindowStart ?? null,
      applicationWindowEnd: analysis.applicationWindowEnd ?? null,
      isApplicationRecommended: analysis.isApplicationRecommended,
      source: 'openweathermap',
      recordedAt: new Date(),
    });

    // Save daily summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minTemp = Math.min(...analysis.hourlyForecast.map((h) => h.temperature));
    const maxTemp = Math.max(...analysis.hourlyForecast.map((h) => h.temperature));
    const avgWind = Math.round(
      (analysis.hourlyForecast.reduce((sum, h) => sum + h.windSpeed, 0) / analysis.hourlyForecast.length) * 10
    ) / 10;

    await db.createWeatherDailySummary({
      userId,
      farmId: farmId || 0,
      summaryDate: today,
      minTemperature: minTemp.toString() as any,
      maxTemperature: maxTemp.toString() as any,
      avgHumidity: Math.round(
        analysis.hourlyForecast.reduce((sum, h) => sum + h.humidity, 0) / analysis.hourlyForecast.length
      ),
      avgWindSpeed: avgWind.toString() as any,
      rainProbability: Math.max(...analysis.hourlyForecast.map((h) => h.rainProbability)),
      operationalClassification: analysis.overallClassification,
      bestApplicationStart: analysis.applicationWindowStart ?? null,
      bestApplicationEnd: analysis.applicationWindowEnd ?? null,
      notes: analysis.notes.join('\n'),
    });

    logger.log({
      service: 'weather',
      action: 'save',
      level: 'info',
      status: 'success',
      userId,
      message: 'Weather analysis saved to database',
    });
  } catch (error) {
    logger.log({
      service: 'weather',
      action: 'save',
      level: 'error',
      status: 'failed',
      userId,
      message: 'Failed to save weather analysis',
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
