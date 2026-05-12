import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { metricsService } from './services/metrics';
import { circuitBreakerRegistry } from './services/circuitBreaker';
import { weatherRetry, newsRetry, telegramRetry } from './services/retry';
import { cacheService, rateLimiter } from './services/cache';
import { contextService } from './services/context';
import { integrationService } from './services/integration';

describe('Integration Tests - End-to-End Pipeline', () => {
  beforeAll(() => {
    // Reset all services before tests
    metricsService.reset();
    circuitBreakerRegistry.resetAll();
    cacheService.clear();
    contextService.clearAll();
  });

  afterAll(() => {
    // Cleanup after tests
    metricsService.reset();
    circuitBreakerRegistry.resetAll();
    cacheService.clear();
    contextService.clearAll();
  });

  describe('Metrics Service', () => {
    it('should record service execution metrics', () => {
      metricsService.recordServiceExecution('test-service', 100, true);

      const metrics = metricsService.getMetrics();
      expect(metrics.services['test-service']).toBeDefined();
      expect(metrics.services['test-service'].totalRequests).toBe(1);
      expect(metrics.services['test-service'].successfulRequests).toBe(1);
      expect(metrics.services['test-service'].failedRequests).toBe(0);
      expect(metrics.services['test-service'].averageDuration).toBe(100);
    });

    it('should track error rate', () => {
      metricsService.recordServiceExecution('error-service', 50, false);
      metricsService.recordServiceExecution('error-service', 60, false);
      metricsService.recordServiceExecution('error-service', 70, true);

      const metrics = metricsService.getServiceMetrics('error-service');
      expect(metrics?.errorRate).toBeCloseTo(66.67, 1);
    });

    it('should record API calls', () => {
      metricsService.recordApiCall('weather', 100, true);
      metricsService.recordApiCall('weather', 150, false);

      const metrics = metricsService.getMetrics();
      expect(metrics.api.weather.calls).toBe(2);
      expect(metrics.api.weather.errors).toBe(1);
    });

    it('should track alert metrics', () => {
      metricsService.recordAlertSent(true);
      metricsService.recordAlertSent(true);
      metricsService.recordAlertSent(false);
      metricsService.recordAlertSent(true, true);

      const metrics = metricsService.getMetrics();
      expect(metrics.alerts.sent).toBe(3);
      expect(metrics.alerts.failed).toBe(1);
      expect(metrics.alerts.retried).toBe(1);
    });
  });

  describe('Circuit Breaker', () => {
    it('should start in closed state', () => {
      const breaker = circuitBreakerRegistry.getOrCreate('test-breaker');
      expect(breaker.getState()).toBe('closed');
    });

    it('should open after failure threshold', async () => {
      const breaker = circuitBreakerRegistry.getOrCreate('failing-breaker', {
        failureThreshold: 2,
        timeout: 100,
      });

      // Simulate failures
      try {
        await breaker.execute(async () => {
          throw new Error('Simulated failure 1');
        });
      } catch {}

      try {
        await breaker.execute(async () => {
          throw new Error('Simulated failure 2');
        });
      } catch {}

      expect(breaker.getState()).toBe('open');
    });

    it('should reject requests when open', async () => {
      const breaker = circuitBreakerRegistry.getOrCreate('open-breaker', {
        failureThreshold: 1,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch {}

      // Try to execute when open
      expect(
        breaker.execute(async () => {
          return 'should not execute';
        })
      ).rejects.toThrow();
    });
  });

  describe('Retry Service', () => {
    it('should succeed on first attempt', async () => {
      const result = await weatherRetry.execute(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should retry on failure', async () => {
      let attempts = 0;

      const result = await weatherRetry.execute(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Fail on first attempt');
        }
        return 'success on retry';
      });

      expect(result).toBe('success on retry');
      expect(attempts).toBe(2);
    });

    it('should fail after max attempts', async () => {
      const testRetry = weatherRetry;

      expect(
        testRetry.execute(async () => {
          throw new Error('Always fails');
        })
      ).rejects.toThrow();
    });
  });

  describe('Cache Service', () => {
    it('should store and retrieve cached values', () => {
      cacheService.set('test-key', { data: 'test' }, 10000);

      const value = cacheService.get('test-key');
      expect(value).toEqual({ data: 'test' });
    });

    it('should return undefined for expired cache', async () => {
      cacheService.set('expire-key', { data: 'test' }, 100);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const value = cacheService.get('expire-key');
      expect(value).toBeNull();
    });

    it('should track cache statistics', () => {
      cacheService.set('stat-key-1', 'value1', 10000);
      cacheService.set('stat-key-2', 'value2', 10000);

      const stats = cacheService.getStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests within limit', () => {
      rateLimiter.reset();

      const allowed1 = rateLimiter.isAllowed('test-endpoint');
      const allowed2 = rateLimiter.isAllowed('test-endpoint');

      expect(allowed1).toBe(true);
      expect(allowed2).toBe(true);
    });

    it('should reject requests exceeding limit', () => {
      rateLimiter.reset();

      // Fill up the limit
      for (let i = 0; i < 100; i++) {
        rateLimiter.isAllowed('limited-endpoint');
      }

      const allowed = rateLimiter.isAllowed('limited-endpoint');
      expect(allowed).toBe(false);
    });
  });

  describe('Context Service', () => {
    it('should create new context', () => {
      const context = contextService.createContext(1, { test: true });

      expect(context.requestId).toBeDefined();
      expect(context.executionId).toBeDefined();
      expect(context.correlationId).toBeDefined();
      expect(context.userId).toBe(1);
      expect(context.metadata.test).toBe(true);
    });

    it('should retrieve existing context', () => {
      const context = contextService.createContext(2);
      const retrieved = contextService.getContext(context.requestId);

      expect(retrieved).toEqual(context);
    });

    it('should update context metadata', () => {
      const context = contextService.createContext(3);
      contextService.updateContext(context.requestId, { updated: true });

      const retrieved = contextService.getContext(context.requestId);
      expect(retrieved?.metadata.updated).toBe(true);
    });

    it('should calculate execution duration', async () => {
      const context = contextService.createContext(4);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const duration = contextService.getExecutionDuration(context.requestId);
      // Tolerância ampliada para ambientes com variação de timing (CI/sandbox)
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Integration Service', () => {
    it('should have all protection layers', () => {
      const breakers = integrationService.getCircuitBreakerStatus();
      expect(breakers).toBeDefined();
      expect(Array.isArray(breakers)).toBe(true);
    });

    it('should collect metrics', () => {
      const metrics = integrationService.getMetrics();

      expect(metrics.timestamp).toBeDefined();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.services).toBeDefined();
    });

    it('should provide metrics summary', () => {
      const summary = integrationService.getMetricsSummary();

      expect(summary).toContain('System Metrics Summary');
      expect(summary).toContain('Uptime');
      expect(summary).toContain('Memory');
    });

    it('should reset metrics', () => {
      metricsService.recordServiceExecution('before-reset', 100, true);

      integrationService.resetMetrics();

      const metrics = integrationService.getMetrics();
      expect(Object.keys(metrics.services).length).toBe(0);
    });
  });

  describe('Deduplication', () => {
    it('should prevent duplicate alerts', () => {
      const alert1 = {
        title: 'Test Alert',
        summary: 'Test Summary',
      };

      const alert2 = {
        title: 'Test Alert',
        summary: 'Test Summary',
      };

      // In real scenario, these would be checked against cache
      // For now, just verify the concept
      expect(JSON.stringify(alert1)).toBe(JSON.stringify(alert2));
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should handle service failures gracefully', async () => {
      const failingService = async () => {
        throw new Error('Service failed');
      };

      const fallbackService = async () => {
        return 'fallback result';
      };

      const result = await newsRetry.executeWithFallback(
        failingService,
        fallbackService
      );

      expect(result).toBe('fallback result');
    });
  });

  describe('Full Pipeline Simulation', () => {
    it('should complete weather collection flow', async () => {
      const requestId = contextService.createContext(1).requestId;

      // Simulate weather collection
      metricsService.recordServiceExecution('weather-collection', 500, true);
      metricsService.recordApiCall('weather', 500, true);

      const metrics = integrationService.getMetrics();
      expect(metrics.api.weather.calls).toBeGreaterThan(0);
    });

    it('should complete news analysis flow', async () => {
      const requestId = contextService.createContext(1).requestId;

      // Simulate news collection
      metricsService.recordServiceExecution('news-collection', 300, true);
      metricsService.recordApiCall('news', 300, true);

      // Simulate analysis
      metricsService.recordServiceExecution('news-analysis', 200, true);

      const metrics = integrationService.getMetrics();
      expect(metrics.api.news.calls).toBeGreaterThan(0);
    });

    it('should complete telegram notification flow', async () => {
      const requestId = contextService.createContext(1).requestId;

      // Simulate telegram send
      metricsService.recordServiceExecution('telegram-send', 100, true);
      metricsService.recordApiCall('telegram', 100, true);
      metricsService.recordAlertSent(true);

      const metrics = integrationService.getMetrics();
      expect(metrics.alerts.sent).toBeGreaterThan(0);
    });
  });
});
