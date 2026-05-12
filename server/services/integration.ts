import { logger } from './logger';
import { metricsService } from './metrics';
import { circuitBreakerRegistry } from './circuitBreaker';
import { weatherRetry, newsRetry, telegramRetry } from './retry';
import { telegramService } from './telegram';
import { openWeatherService } from './openweather';
import { newsCollectorService } from './newsCollector';
import { newsAnalysisService } from './newsAnalysis';
import { contextService } from './context';
import * as db from '../db';

/**
 * Integration service
 * Orchestrates all critical services with metrics, circuit breaker, and retry
 */
class IntegrationService {
  /**
   * Collect weather with full protection
   */
  async collectWeatherWithProtection(userId: number, requestId: string) {
    const startTime = Date.now();
    const breaker = circuitBreakerRegistry.getOrCreate('weather-api');

    try {
      const result = await breaker.execute(async () => {
        return await weatherRetry.execute(async () => {
          return await openWeatherService.getHourlyForecast();
        });
      });

      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('weather-collection', duration, true);
      metricsService.recordApiCall('weather', duration, true);

      contextService.updateContext(requestId, {
        weatherCollected: true,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('weather-collection', duration, false);
      metricsService.recordApiCall('weather', duration, false);

      logger.log({
        service: 'integration',
        action: 'collect_weather',
        level: 'error',
        status: 'failed',
        message: 'Failed to collect weather',
        error: error instanceof Error ? error.message : String(error),
        metadata: { userId, requestId, duration },
      });

      throw error;
    }
  }

  /**
   * Collect news with full protection
   */
  async collectNewsWithProtection(userId: number, requestId: string) {
    const startTime = Date.now();
    const breaker = circuitBreakerRegistry.getOrCreate('news-api');

    try {
      const result = await breaker.execute(async () => {
        return await newsRetry.execute(async () => {
          return await newsCollectorService.collectNews();
        });
      });

      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('news-collection', duration, true);
      metricsService.recordApiCall('news', duration, true);

      contextService.updateContext(requestId, {
        newsCollected: true,
        newsCount: result.length,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('news-collection', duration, false);
      metricsService.recordApiCall('news', duration, false);

      logger.log({
        service: 'integration',
        action: 'collect_news',
        level: 'error',
        status: 'failed',
        message: 'Failed to collect news',
        error: error instanceof Error ? error.message : String(error),
        metadata: { userId, requestId, duration },
      });

      throw error;
    }
  }

  /**
   * Analyze news with LLM and full protection
   */
  async analyzeNewsWithProtection(news: any[], userId: number, requestId: string) {
    const startTime = Date.now();

    try {
      const analysis = await newsRetry.execute(async () => {
        return await newsAnalysisService.analyzeNews(news);
      });

      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('news-analysis', duration, true);

      contextService.updateContext(requestId, {
        newsAnalyzed: true,
        duration,
      });

      return analysis;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('news-analysis', duration, false);

      logger.log({
        service: 'integration',
        action: 'analyze_news',
        level: 'error',
        status: 'failed',
        message: 'Failed to analyze news',
        error: error instanceof Error ? error.message : String(error),
        metadata: { userId, requestId, newsCount: news.length, duration },
      });

      throw error;
    }
  }

  /**
   * Send Telegram notification with full protection
   */
  async sendTelegramWithProtection(
    userId: number,
    farmId: number,
    message: string,
    priority: 'low' | 'normal' | 'high' | 'critical' = 'normal',
    requestId: string
  ) {
    const startTime = Date.now();
    const breaker = circuitBreakerRegistry.getOrCreate('telegram-api');

    try {
      const result = await breaker.execute(async () => {
        return await telegramRetry.execute(async () => {
          const settings = await db.getUserSettings(userId, farmId);
          if (!settings?.telegramChatId || !settings?.telegramToken) {
            throw new Error('Telegram chat ID or Token not configured for this farm');
          }
          return await telegramService.sendMessage(settings.telegramToken, settings.telegramChatId, message, priority);
        });
      });

      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('telegram-send', duration, true);
      metricsService.recordApiCall('telegram', duration, true);
      metricsService.recordAlertSent(true);

      contextService.updateContext(requestId, {
        telegramSent: true,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordServiceExecution('telegram-send', duration, false);
      metricsService.recordApiCall('telegram', duration, false);
      metricsService.recordAlertSent(false);

      logger.log({
        service: 'integration',
        action: 'send_telegram',
        level: 'error',
        status: 'failed',
        message: 'Failed to send Telegram message',
        error: error instanceof Error ? error.message : String(error),
        userId,
        farmId,
        metadata: { requestId, priority, duration },
      });

      throw error;
    }
  }

  /**
   * Get all circuit breaker statuses
   */
  getCircuitBreakerStatus() {
    return circuitBreakerRegistry.getAllStatuses();
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return metricsService.getMetrics();
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    return metricsService.getSummary();
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    metricsService.reset();
    circuitBreakerRegistry.resetAll();

    logger.log({
      service: 'integration',
      action: 'reset_metrics',
      level: 'info',
      status: 'success',
      message: 'All metrics and circuit breakers reset',
    });
  }
}

export const integrationService = new IntegrationService();
