import { logger } from './logger';
import * as db from '../db';
import { cacheService, rateLimiter } from './cache';
import { telegramService } from './telegram';
import { scheduler } from './scheduler';
import { openWeatherService } from './openweather';
import { newsCollectorService } from './newsCollector';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
    checks: {
    database: HealthCheckStatus;
    cache: HealthCheckStatus;
    telegram: HealthCheckStatus;
    weather: HealthCheckStatus;
    newsCollector: HealthCheckStatus;
    scheduler: HealthCheckStatus;
    memory: HealthCheckStatus;
    rateLimiter: HealthCheckStatus;
    ai: HealthCheckStatus;
  };
  summary: string;
}

export interface HealthCheckStatus {
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
  responseTime?: number;
}

/**
 * Health check service
 * Validates all system subsystems
 */
class HealthCheckService {
  /**
   * Run complete health check
   */
  async runHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    logger.log({
      service: 'healthcheck',
      action: 'run',
      level: 'info',
      status: 'pending',
      message: 'Starting health check',
    });

    const checks = {
      database: await this.checkDatabase(),
      cache: this.checkCache(),
      telegram: this.checkTelegram(),
      weather: this.checkWeather(),
      newsCollector: this.checkNewsCollector(),
      scheduler: this.checkScheduler(),
      memory: this.checkMemory(),
      rateLimiter: this.checkRateLimiter(),
      ai: this.checkAI(),
    };

    const duration = Date.now() - startTime;

    // Determine overall status
    const errorCount = Object.values(checks).filter((c) => c.status === 'error').length;
    const warningCount = Object.values(checks).filter((c) => c.status === 'warning').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (errorCount > 0) overallStatus = 'unhealthy';
    else if (warningCount > 0) overallStatus = 'degraded';

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date(),
      checks,
      summary: `Health check completed in ${duration}ms. Status: ${overallStatus}. Errors: ${errorCount}, Warnings: ${warningCount}`,
    };

    logger.log({
      service: 'healthcheck',
      action: 'run',
      level: 'info',
      status: 'success',
      message: 'Health check completed',
      metadata: {
        duration,
        status: overallStatus,
        errors: errorCount,
        warnings: warningCount,
      },
    });

    return result;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckStatus> {
    const startTime = Date.now();

    try {
      const dbInstance = await db.getDb();

      if (!dbInstance) {
        return {
          status: 'error',
          message: 'Database not available',
          responseTime: Date.now() - startTime,
        };
      }

      // Try a simple query
      const users = await db.getUserByOpenId('health-check');

      return {
        status: 'ok',
        message: 'Database connected and responding',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Database error: ${error instanceof Error ? error.message : String(error)}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check cache service
   */
  private checkCache(): HealthCheckStatus {
    try {
      const stats = cacheService.getStats();

      if (stats.size > 1000) {
        return {
          status: 'warning',
          message: 'Cache size is large',
          details: stats,
        };
      }

      return {
        status: 'ok',
        message: 'Cache service operational',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Cache error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check Telegram service
   */
  private checkTelegram(): HealthCheckStatus {
    try {
      const stats = telegramService.getQueueStatus();

      if (stats.totalQueued > 100) {
        return {
          status: 'warning',
          message: 'Telegram queue is building up',
          details: stats,
        };
      }

      return {
        status: 'ok',
        message: 'Telegram service operational',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Telegram error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check weather service
   */
  private checkWeather(): HealthCheckStatus {
    try {
      const stats = openWeatherService.getStats();

      return {
        status: 'ok',
        message: 'Weather service operational',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Weather error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check news collector
   */
  private checkNewsCollector(): HealthCheckStatus {
    try {
      const stats = newsCollectorService.getStats();

      return {
        status: 'ok',
        message: 'News collector operational',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `News collector error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check scheduler status
   */
  private checkScheduler(): HealthCheckStatus {
    try {
      const status = scheduler.getStatus();

      if (!status.isRunning) {
        return {
          status: 'warning',
          message: 'Scheduler not running',
          details: status,
        };
      }

      return {
        status: 'ok',
        message: 'Scheduler operational',
        details: status,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Scheduler error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check AI service status
   */
  private checkAI(): HealthCheckStatus {
    try {
      const hasApiKey = !!process.env.OPENAI_API_KEY;

      if (!hasApiKey) {
        return {
          status: 'error',
          message: 'AI API Key not configured',
        };
      }

      return {
        status: 'ok',
        message: 'AI service configured',
      };
    } catch (error) {
      return {
        status: 'error',
        message: `AI check error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): HealthCheckStatus {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (heapUsedPercent > 90) {
        return {
          status: 'error',
          message: 'Memory usage critical',
          details: {
            heapUsedPercent: heapUsedPercent.toFixed(2),
            heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          },
        };
      }

      if (heapUsedPercent > 75) {
        return {
          status: 'warning',
          message: 'Memory usage high',
          details: {
            heapUsedPercent: heapUsedPercent.toFixed(2),
            heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          },
        };
      }

      return {
        status: 'ok',
        message: 'Memory usage normal',
        details: {
          heapUsedPercent: heapUsedPercent.toFixed(2),
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Memory check error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check rate limiter
   */
  private checkRateLimiter(): HealthCheckStatus {
    try {
      const stats = rateLimiter.getStats();

      return {
        status: 'ok',
        message: 'Rate limiter operational',
        details: stats,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Rate limiter error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

export const healthCheckService = new HealthCheckService();
