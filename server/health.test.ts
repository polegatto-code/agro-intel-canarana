import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import healthRoutes from './routes/health';

describe('Health Endpoints - HTTP Tests', () => {
  let app: express.Application;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/', healthRoutes);

    server = createServer(app);

    return new Promise<void>((resolve) => {
      server.listen(3001, () => {
        baseUrl = 'http://localhost:3001';
        resolve();
      });
    });
  });

  afterAll(async () => {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(504);

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
    });

    it('should include timestamp', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();

      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('string');
      // Validate ISO timestamp format
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const response = await fetch(`${baseUrl}/health/live`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('alive');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await fetch(`${baseUrl}/health/ready`);
      expect([200, 503]).toContain(response.status);

      const data = await response.json();
      expect(['ready', 'not-ready']).toContain(data.status);
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus format metrics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      expect(response.status).toBe(200);

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('text/plain');

      const text = await response.text();
      // Validate Prometheus format
      expect(text).toContain('# HELP');
      expect(text).toContain('# TYPE');
      expect(text).toContain('system_uptime_seconds');
      expect(text).toContain('system_memory_heap_bytes');
    });

    it('should include service metrics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      const text = await response.text();

      expect(text).toContain('service_requests_total');
      expect(text).toContain('service_errors_total');
      expect(text).toContain('service_duration_ms');
    });

    it('should include alert metrics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      const text = await response.text();

      expect(text).toContain('alerts_sent_total');
      expect(text).toContain('alerts_failed_total');
      expect(text).toContain('alerts_retried_total');
    });

    it('should have valid Prometheus format', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      const text = await response.text();

      const lines = text.split('\n').filter((line) => line.trim());

      // Count metrics
      const metricLines = lines.filter((line) => !line.startsWith('#'));
      expect(metricLines.length).toBeGreaterThan(0);

      // Validate metric format (name{labels} value)
      for (const line of metricLines) {
        if (line.trim()) {
          expect(line).toMatch(/^[a-z_][a-z0-9_]*(\{[^}]*\})?\s+[\d.e+-]+$/i);
        }
      }
    });
  });

  describe('GET /debug/contexts', () => {
    it('should return contexts info', async () => {
      const response = await fetch(`${baseUrl}/debug/contexts`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('contexts');
      expect(Array.isArray(data.contexts)).toBe(true);
      expect(typeof data.count).toBe('number');
    });

    it('should have valid context structure', async () => {
      const response = await fetch(`${baseUrl}/debug/contexts`);
      const data = await response.json();

      if (data.contexts.length > 0) {
        const context = data.contexts[0];
        expect(context).toHaveProperty('requestId');
        expect(context).toHaveProperty('executionId');
        expect(context).toHaveProperty('correlationId');
        expect(context).toHaveProperty('metadata');
      }
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return appropriate status codes', async () => {
      const healthResponse = await fetch(`${baseUrl}/health`);
      expect([200, 503]).toContain(healthResponse.status);

      const liveResponse = await fetch(`${baseUrl}/health/live`);
      expect(liveResponse.status).toBe(200);

      const readyResponse = await fetch(`${baseUrl}/health/ready`);
      expect([200, 503]).toContain(readyResponse.status);

      const metricsResponse = await fetch(`${baseUrl}/metrics`);
      expect(metricsResponse.status).toBe(200);
    });
  });

  describe('Response Headers', () => {
    it('should have correct content-type for metrics', async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      const contentType = response.headers.get('content-type');

      expect(contentType).toBeDefined();
      expect(contentType).toContain('text/plain');
    });

    it('should have correct content-type for JSON endpoints', async () => {
      const response = await fetch(`${baseUrl}/health`);
      const contentType = response.headers.get('content-type');

      expect(contentType).toBeDefined();
      expect(contentType).toContain('application/json');
    });
  });
});
