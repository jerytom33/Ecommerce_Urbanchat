import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import Fastify from 'fastify';
import { config } from '../config.js';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { authenticate } from './authenticate.js';

/**
 * Creates a minimal Fastify server with a protected route for testing
 * the authenticate middleware.
 */
async function buildTestServer(): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  errorHandlerPlugin(fastify);

  // Protected route that requires authentication
  fastify.get('/protected', { preHandler: [authenticate] }, async (request) => {
    return { user: request.user };
  });

  return fastify;
}

function generateToken(payload: object, options?: jwt.SignOptions): string {
  return jwt.sign(payload, config.jwt.secret, options);
}

describe('authenticate middleware', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildTestServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('successful authentication', () => {
    it('attaches decoded user payload to request when token is valid', async () => {
      const payload = { userId: 'user-123', tenantId: 'tenant-456', role: 'admin' };
      const token = generateToken(payload, { expiresIn: '15m' });

      const response = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.userId).toBe('user-123');
      expect(body.user.tenantId).toBe('tenant-456');
      expect(body.user.role).toBe('admin');
    });

    it('works with all valid RBAC roles', async () => {
      const roles = ['owner', 'admin', 'staff', 'read-only'];

      for (const role of roles) {
        const payload = { userId: 'user-1', tenantId: 'tenant-1', role };
        const token = generateToken(payload, { expiresIn: '15m' });

        const response = await server.inject({
          method: 'GET',
          url: '/protected',
          headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.user.role).toBe(role);
      }
    });
  });

  describe('missing token', () => {
    it('returns 401 with TOKEN_MISSING when no Authorization header', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/protected',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('TOKEN_MISSING');
      expect(body.error.message).toContain('Bearer token is required');
      expect(body.error.request_id).toBeDefined();
    });

    it('returns 401 with TOKEN_MISSING when Authorization header is not Bearer scheme', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('TOKEN_MISSING');
    });

    it('returns 401 with TOKEN_MISSING when Bearer has no token value', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('TOKEN_MISSING');
    });
  });

  describe('expired token', () => {
    it('returns 401 with TOKEN_EXPIRED when token has expired', async () => {
      const payload = { userId: 'user-1', tenantId: 'tenant-1', role: 'staff' };
      // Create a token that expired 1 hour ago
      const token = generateToken(payload, { expiresIn: '-1h' });

      const response = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('TOKEN_EXPIRED');
      expect(body.error.message).toContain('expired');
      expect(body.error.request_id).toBeDefined();
    });
  });

  describe('invalid token', () => {
    it('returns 401 with TOKEN_INVALID when token is malformed', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer not-a-valid-jwt-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('TOKEN_INVALID');
      expect(body.error.message).toContain('invalid or malformed');
      expect(body.error.request_id).toBeDefined();
    });

    it('returns 401 with TOKEN_INVALID when token is signed with wrong secret', async () => {
      const payload = { userId: 'user-1', tenantId: 'tenant-1', role: 'admin' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '15m' });

      const response = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('TOKEN_INVALID');
    });
  });
});
