import { logger } from './logger';

export interface ServiceMetrics {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  lastExecuted?: Date;
  errorRate: number;
}

export interface SystemMetrics {
  timestamp: Date;
  uptime: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    heapUsedPercent: number;
    external: number;
    rss: number;
  };
  services: Record<string, ServiceMetrics>;
  alerts: {
    sent: number;
    failed: number;
    retried: number;
  };
  api: {
    weather: {
      calls: number;
      errors: number;
      avgResponseTime: number;
    };
    news: {
      calls: number;
      errors: number;
      avgResponseTime: number;
    };
    telegram: {
      sent: number;
      failed: number;
      queued: number;
      avgResponseTime: number;
    };
  };
}

/**
 * Metrics service
 * Tracks system performance and health metrics
 */
class MetricsService {
  private serviceMetrics: Map<string, ServiceMetrics> = new Map();
  private startTime = Date.now();
  private alertMetrics = {
    sent: 0,
    failed: 0,
    retried: 0,
  };
  private apiMetrics: Record<string, any> = {
    weather: { calls: 0, errors: 0, totalTime: 0 },
    news: { calls: 0, errors: 0, totalTime: 0 },
    telegram: { sent: 0, failed: 0, queued: 0, totalTime: 0 },
  };

  /**
   * Record service execution
   */
  recordServiceExecution(
    serviceName: string,
    duration: number,
    success: boolean,
    error?: string
  ): void {
    let metrics = this.serviceMetrics.get(serviceName);

    if (!metrics) {
      metrics = {
        name: serviceName,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errorRate: 0,
      };
      this.serviceMetrics.set(serviceName, metrics);
    }

    metrics.totalRequests++;
    metrics.totalDuration += duration;
    metrics.averageDuration = metrics.totalDuration / metrics.totalRequests;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.lastExecuted = new Date();

    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;

    logger.log({
      service: 'metrics',
      action: 'record_execution',
      level: 'debug',
      status: 'success',
      message: `Recorded execution for ${serviceName}`,
      metadata: {
        serviceName,
        duration,
        success,
        error,
      },
    });
  }

  /**
   * Record API call
   */
  recordApiCall(
    apiName: 'weather' | 'news' | 'telegram',
    duration: number,
    success: boolean
  ): void {
    const api = this.apiMetrics[apiName];

    if (apiName === 'telegram') {
      if (success) {
        api.sent++;
      } else {
        api.failed++;
      }
    } else {
      api.calls++;
      if (!success) {
        api.errors++;
      }
    }

    api.totalTime += duration;
  }

  /**
   * Record alert sent
   */
  recordAlertSent(success: boolean, retried: boolean = false): void {
    if (success) {
      this.alertMetrics.sent++;
    } else {
      this.alertMetrics.failed++;
    }

    if (retried) {
      this.alertMetrics.retried++;
    }
  }

  /**
   * Update Telegram queue size
   */
  updateTelegramQueueSize(size: number): void {
    this.apiMetrics.telegram.queued = size;
  }

  /**
   * Get all metrics
   */
  getMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();

    return {
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        heapUsedPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      services: Object.fromEntries(this.serviceMetrics),
      alerts: this.alertMetrics,
      api: {
        weather: {
          calls: this.apiMetrics.weather.calls,
          errors: this.apiMetrics.weather.errors,
          avgResponseTime:
            this.apiMetrics.weather.calls > 0
              ? this.apiMetrics.weather.totalTime / this.apiMetrics.weather.calls
              : 0,
        },
        news: {
          calls: this.apiMetrics.news.calls,
          errors: this.apiMetrics.news.errors,
          avgResponseTime:
            this.apiMetrics.news.calls > 0
              ? this.apiMetrics.news.totalTime / this.apiMetrics.news.calls
              : 0,
        },
        telegram: {
          sent: this.apiMetrics.telegram.sent,
          failed: this.apiMetrics.telegram.failed,
          queued: this.apiMetrics.telegram.queued,
          avgResponseTime:
            this.apiMetrics.telegram.sent > 0
              ? this.apiMetrics.telegram.totalTime / this.apiMetrics.telegram.sent
              : 0,
        },
      },
    };
  }

  /**
   * Get service metrics
   */
  getServiceMetrics(serviceName: string): ServiceMetrics | undefined {
    return this.serviceMetrics.get(serviceName);
  }

  /**
   * Get all service metrics
   */
  getAllServiceMetrics(): ServiceMetrics[] {
    return Array.from(this.serviceMetrics.values());
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.serviceMetrics.clear();
    this.startTime = Date.now();
    this.alertMetrics = { sent: 0, failed: 0, retried: 0 };
    this.apiMetrics = {
      weather: { calls: 0, errors: 0, totalTime: 0 },
      news: { calls: 0, errors: 0, totalTime: 0 },
      telegram: { sent: 0, failed: 0, queued: 0, totalTime: 0 },
    } as Record<string, any>;

    logger.log({
      service: 'metrics',
      action: 'reset',
      level: 'info',
      status: 'success',
      message: 'Metrics reset',
    });
  }

  /**
   * Get summary
   */
  getSummary(): string {
    const metrics = this.getMetrics();
    const totalServices = metrics.services ? Object.keys(metrics.services).length : 0;
    const failedServices = metrics.services
      ? Object.values(metrics.services).filter((s) => s.errorRate > 0).length
      : 0;

    return `
System Metrics Summary:
- Uptime: ${(metrics.uptime / 1000 / 60).toFixed(2)} minutes
- Memory: ${(metrics.memoryUsage.heapUsedPercent).toFixed(2)}% of heap used
- Services: ${totalServices} tracked, ${failedServices} with errors
- Alerts: ${metrics.alerts.sent} sent, ${metrics.alerts.failed} failed
- Weather API: ${metrics.api.weather.calls} calls, ${metrics.api.weather.errors} errors
- News API: ${metrics.api.news.calls} calls, ${metrics.api.news.errors} errors
- Telegram: ${metrics.api.telegram.sent} sent, ${metrics.api.telegram.failed} failed, ${metrics.api.telegram.queued} queued
    `.trim();
  }
}

export const metricsService = new MetricsService();
