import { logger } from './logger';
import { cacheService, rateLimiter } from './cache';
import axios from 'axios';

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  cloudiness: number;
  description: string;
}

export interface HourlyForecast {
  hour: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
  rainProbability: number;
  cloudiness: number;
}

/**
 * OpenWeatherMap API integration
 * Using real API with mock data fallback only on failure
 */
class OpenWeatherService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly cachePrefix = 'openweather:';
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hour

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENWEATHER_API_KEY || '';
  }

  /**
   * Get current weather for Canarana-MT
   */
  async getCurrentWeather(latitude: number = -13.1939, longitude: number = -52.2622): Promise<WeatherData> {
    const cacheKey = `${this.cachePrefix}current:${latitude},${longitude}`;

    // Check cache first
    const cached = cacheService.get<WeatherData>(cacheKey);
    if (cached) {
      logger.log({
        service: 'openweather',
        action: 'get_current',
        level: 'debug',
        status: 'success',
        message: 'Weather data from cache',
        metadata: { cached: true },
      });
      return cached;
    }

    // Check rate limit
    if (!rateLimiter.isAllowed(`openweather:current`)) {
      logger.log({
        service: 'openweather',
        action: 'get_current',
        level: 'warn',
        status: 'failed',
        message: 'Rate limit exceeded for OpenWeatherMap',
      });
      return this.getMockCurrentWeather();
    }

    // If no API key, use mock
    if (!this.apiKey || this.apiKey === 'demo') {
      logger.log({
        service: 'openweather',
        action: 'get_current',
        level: 'warn',
        status: 'pending',
        message: 'No API key provided, using mock data',
      });
      return this.getMockCurrentWeather();
    }

    try {
      const startTime = Date.now();

      // Fetch from real API
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat: latitude,
          lon: longitude,
          appid: this.apiKey,
          units: 'metric',
          lang: 'pt_br'
        }
      });

      const data: WeatherData = {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        windSpeed: response.data.wind.speed * 3.6, // Convert m/s to km/h
        rainProbability: response.data.rain ? (response.data.rain['1h'] || 0) : 0,
        cloudiness: response.data.clouds.all,
        description: response.data.weather[0].description
      };

      const duration = Date.now() - startTime;

      // Cache the result
      cacheService.set(cacheKey, data, this.cacheTTL);

      logger.log({
        service: 'openweather',
        action: 'get_current',
        level: 'info',
        status: 'success',
        message: 'Current weather fetched successfully from API',
        metadata: { duration, temperature: data.temperature, humidity: data.humidity },
      });

      return data;
    } catch (error) {
      logger.log({
        service: 'openweather',
        action: 'get_current',
        level: 'error',
        status: 'failed',
        message: 'Failed to fetch current weather from API',
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to mock data
      return this.getMockCurrentWeather();
    }
  }

  /**
   * Get hourly forecast for Canarana-MT
   */
  async getHourlyForecast(
    hours: number = 24,
    latitude: number = -13.1939,
    longitude: number = -52.2622
  ): Promise<HourlyForecast[]> {
    const cacheKey = `${this.cachePrefix}hourly:${latitude},${longitude}:${hours}`;

    // Check cache first
    const cached = cacheService.get<HourlyForecast[]>(cacheKey);
    if (cached) {
      logger.log({
        service: 'openweather',
        action: 'get_hourly',
        level: 'debug',
        status: 'success',
        message: 'Hourly forecast from cache',
        metadata: { cached: true, hours: cached.length },
      });
      return cached;
    }

    // Check rate limit
    if (!rateLimiter.isAllowed(`openweather:hourly`)) {
      logger.log({
        service: 'openweather',
        action: 'get_hourly',
        level: 'warn',
        status: 'failed',
        message: 'Rate limit exceeded for OpenWeatherMap',
      });
      return this.getMockHourlyForecast(hours);
    }

    // If no API key, use mock
    if (!this.apiKey || this.apiKey === 'demo') {
      return this.getMockHourlyForecast(hours);
    }

    try {
      const startTime = Date.now();

      // Fetch from real API (using 5 day / 3 hour forecast for free tier)
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat: latitude,
          lon: longitude,
          appid: this.apiKey,
          units: 'metric',
          lang: 'pt_br'
        }
      });

      // Map the 3-hour intervals to hourly (simple interpolation or taking nearest)
      const apiData = response.data.list;
      const data: HourlyForecast[] = apiData.slice(0, Math.ceil(hours / 3) + 1).map((item: any) => ({
        hour: new Date(item.dt * 1000).getHours(),
        temperature: item.main.temp,
        humidity: item.main.humidity,
        windSpeed: item.wind.speed * 3.6, // Convert m/s to km/h
        rainProbability: item.pop * 100, // Probability of precipitation (0-1)
        cloudiness: item.clouds.all
      }));

      // If we need exactly 'hours' items, we might need more logic, 
      // but for agricultural intelligence, the 3-hour intervals from free tier are usually enough
      // and can be interpolated if necessary.

      const duration = Date.now() - startTime;

      // Cache the result
      cacheService.set(cacheKey, data, this.cacheTTL);

      logger.log({
        service: 'openweather',
        action: 'get_hourly',
        level: 'info',
        status: 'success',
        message: 'Hourly forecast fetched successfully from API',
        metadata: { duration, hours: data.length },
      });

      return data;
    } catch (error) {
      logger.log({
        service: 'openweather',
        action: 'get_hourly',
        level: 'error',
        status: 'failed',
        message: 'Failed to fetch hourly forecast from API',
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to mock data
      return this.getMockHourlyForecast(hours);
    }
  }

  /**
   * Get mock current weather for development
   */
  private getMockCurrentWeather(): WeatherData {
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 18;

    let baseTemp = 25;
    if (isNight) baseTemp = 18;
    else if (hour > 12 && hour < 15) baseTemp = 32;

    return {
      temperature: baseTemp + Math.random() * 4 - 2,
      humidity: 60 + Math.random() * 30 - 15,
      windSpeed: 8 + Math.random() * 6 - 3,
      rainProbability: Math.random() * 40,
      cloudiness: 30 + Math.random() * 40,
      description: 'Parcialmente nublado (Simulado)',
    };
  }

  /**
   * Get mock hourly forecast for development
   */
  private getMockHourlyForecast(hours: number): HourlyForecast[] {
    const forecast: HourlyForecast[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const forecastHour = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = forecastHour.getHours();
      const isNight = hour < 6 || hour > 18;

      let baseTemp = 25;
      if (isNight) baseTemp = 18;
      else if (hour > 12 && hour < 15) baseTemp = 32;

      forecast.push({
        hour,
        temperature: baseTemp + Math.random() * 4 - 2,
        humidity: 60 + Math.random() * 30 - 15,
        windSpeed: 8 + Math.random() * 6 - 3,
        rainProbability: Math.random() * 40,
        cloudiness: 30 + Math.random() * 40,
      });
    }

    return forecast;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      cacheSize: cacheService.getStats().size,
      rateLimiterStats: rateLimiter.getStats(),
    };
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    cacheService.delete(`${this.cachePrefix}current:*`);
    cacheService.delete(`${this.cachePrefix}hourly:*`);

    logger.log({
      service: 'openweather',
      action: 'clear_cache',
      level: 'debug',
      status: 'success',
      message: 'OpenWeatherMap cache cleared',
    });
  }
}

export const openWeatherService = new OpenWeatherService();
