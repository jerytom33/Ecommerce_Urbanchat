import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';

describe('Fastify API Server', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Health Check', () => {
    it('GET /health returns status ok', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Route Prefixes', () => {
    it('GET /api/v1/admin/ returns admin API response', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Admin API v1');
    });

    it('GET /api/v1/storefront/ returns storefront API response', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/storefront/',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Storefront API v1');
    });
  });

  describe('Correlation ID Middleware', () => {
    it('generates a correlation ID when none is provided', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const requestId = response.headers['x-request-id'];
      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
      // UUID format: 8-4-4-4-12
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('uses provided x-request-id header', async () => {
      const customId = 'custom-trace-id-123';
      const response = await server.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'x-request-id': customId,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe(customId);
    });
  });

  describe('Structured Error Responses', () => {
    it('returns 404 with ApiError format for unknown routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('/api/v1/nonexistent');
      expect(body.error.request_id).toBeDefined();
    });

    it('includes request_id in error responses', async () => {
      const customId = 'trace-for-error-test';
      const response = await server.inject({
        method: 'GET',
        url: '/nonexistent',
        headers: {
          'x-request-id': customId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.request_id).toBe(customId);
    });
  });

  describe('CORS', () => {
    it('returns CORS headers for allowed origin', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });
});
