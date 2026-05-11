import { Router } from 'express';
import { healthCheckService } from '../services/healthcheck';
import { metricsService } from '../services/metrics';
import { contextService } from '../services/context';

const router = Router();

/**
 * GET /health - Basic health check
 * Returns 200 if service is running
 */
router.get('/health', async (_req, res) => {
  try {
    const health = await healthCheckService.runHealthCheck();

    if (health.status === 'healthy') {
      return res.status(200).json(health);
    } else if (health.status === 'degraded') {
      return res.status(200).json(health);
    } else {
      return res.status(503).json(health);
    }
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/live - Liveness probe
 */
router.get('/health/live', (_req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready - Readiness probe
 */
router.get('/health/ready', async (_req, res) => {
  try {
    const health = await healthCheckService.runHealthCheck();

    if (health.status === 'healthy' || health.status === 'degraded') {
      return res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      return res.status(503).json({
        status: 'not-ready',
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    return res.status(503).json({
      status: 'not-ready',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /metrics - Prometheus-style metrics
 */
router.get('/metrics', (_req, res) => {
  const metrics = metricsService.getMetrics();

  // Convert to Prometheus format
  let prometheusMetrics = '';

  // System metrics
  prometheusMetrics += `# HELP system_uptime_seconds System uptime in seconds\n`;
  prometheusMetrics += `# TYPE system_uptime_seconds gauge\n`;
  prometheusMetrics += `system_uptime_seconds ${metrics.uptime / 1000}\n\n`;

  prometheusMetrics += `# HELP system_memory_heap_bytes Heap memory usage in bytes\n`;
  prometheusMetrics += `# TYPE system_memory_heap_bytes gauge\n`;
  prometheusMetrics += `system_memory_heap_bytes ${metrics.memoryUsage.heapUsed}\n\n`;

  prometheusMetrics += `# HELP system_memory_rss_bytes RSS memory usage in bytes\n`;
  prometheusMetrics += `# TYPE system_memory_rss_bytes gauge\n`;
  prometheusMetrics += `system_memory_rss_bytes ${metrics.memoryUsage.rss}\n\n`;

  // Service metrics
  prometheusMetrics += `# HELP service_requests_total Total requests by service\n`;
  prometheusMetrics += `# TYPE service_requests_total counter\n`;
  for (const [service, data] of Object.entries(metrics.services)) {
    prometheusMetrics += `service_requests_total{service="${service}"} ${data.totalRequests}\n`;
  }
  prometheusMetrics += '\n';

  prometheusMetrics += `# HELP service_errors_total Total errors by service\n`;
  prometheusMetrics += `# TYPE service_errors_total counter\n`;
  for (const [service, data] of Object.entries(metrics.services)) {
    prometheusMetrics += `service_errors_total{service="${service}"} ${data.failedRequests}\n`;
  }
  prometheusMetrics += '\n';

  prometheusMetrics += `# HELP service_duration_ms Average duration by service\n`;
  prometheusMetrics += `# TYPE service_duration_ms gauge\n`;
  for (const [service, data] of Object.entries(metrics.services)) {
    prometheusMetrics += `service_duration_ms{service="${service}"} ${data.averageDuration}\n`;
  }
  prometheusMetrics += '\n';

  // Alert metrics
  prometheusMetrics += `# HELP alerts_sent_total Total alerts sent\n`;
  prometheusMetrics += `# TYPE alerts_sent_total counter\n`;
  prometheusMetrics += `alerts_sent_total ${metrics.alerts.sent}\n`;

  prometheusMetrics += `# HELP alerts_failed_total Total alerts failed\n`;
  prometheusMetrics += `# TYPE alerts_failed_total counter\n`;
  prometheusMetrics += `alerts_failed_total ${metrics.alerts.failed}\n`;

  prometheusMetrics += `# HELP alerts_retried_total Total alerts retried\n`;
  prometheusMetrics += `# TYPE alerts_retried_total counter\n`;
  prometheusMetrics += `alerts_retried_total ${metrics.alerts.retried}\n`;

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(prometheusMetrics);
});

/**
 * GET /debug/contexts - Debug endpoint
 */
router.get('/debug/contexts', (_req, res) => {
  const contexts = contextService.getAllContexts();
  res.json({
    count: contextService.getContextCount(),
    contexts: contexts.map((ctx) => ({
      requestId: ctx.requestId,
      executionId: ctx.executionId,
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      duration: contextService.getExecutionDuration(ctx.requestId),
      metadata: ctx.metadata,
    })),
  });
});

export default router;
