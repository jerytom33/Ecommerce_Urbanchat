import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { buildServer } from '../server.js';
import { authenticate } from './authenticate.js';
import { requireRole, TenantRole } from './require-role.js';
import { config } from '../config.js';

/**
 * Helper to generate a valid JWT for testing.
 */
function generateToken(payload: { userId: string; tenantId: string; role: string }): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: '15m' });
}

describe('requireRole Middleware', () => {
  let server: FastifyInstance;

  const testUser = {
    userId: 'user-123',
    tenantId: 'tenant-456',
  };

  beforeAll(async () => {
    server = await buildServer({ logger: false });

    // Register test routes with different role requirements
    server.get(
      '/test/owner-only',
      { preHandler: [authenticate, requireRole('owner')] },
      async () => ({ access: 'granted' }),
    );

    server.get(
      '/test/admin-up',
      { preHandler: [authenticate, requireRole('owner', 'admin')] },
      async () => ({ access: 'granted' }),
    );

    server.get(
      '/test/staff-up',
      { preHandler: [authenticate, requireRole('owner', 'admin', 'staff')] },
      async () => ({ access: 'granted' }),
    );

    server.get(
      '/test/all-roles',
      { preHandler: [authenticate, requireRole('owner', 'admin', 'staff', 'read-only')] },
      async () => ({ access: 'granted' }),
    );

    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Owner-only route', () => {
    it('allows owner access', async () => {
      const token = generateToken({ ...testUser, role: 'owner' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/owner-only',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ access: 'granted' });
    });

    it('denies admin access with 403', async () => {
      const token = generateToken({ ...testUser, role: 'admin' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/owner-only',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(body.error.message).toContain("Role 'admin'");
      expect(body.error.message).toContain('owner');
      expect(body.error.request_id).toBeDefined();
    });

    it('denies staff access with 403', async () => {
      const token = generateToken({ ...testUser, role: 'staff' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/owner-only',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('denies read-only access with 403', async () => {
      const token = generateToken({ ...testUser, role: 'read-only' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/owner-only',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Admin-up route (owner, admin)', () => {
    it('allows owner access', async () => {
      const token = generateToken({ ...testUser, role: 'owner' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/admin-up',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('allows admin access', async () => {
      const token = generateToken({ ...testUser, role: 'admin' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/admin-up',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('denies staff access', async () => {
      const token = generateToken({ ...testUser, role: 'staff' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/admin-up',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(body.error.message).toContain('owner, admin');
    });

    it('denies read-only access', async () => {
      const token = generateToken({ ...testUser, role: 'read-only' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/admin-up',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Staff-up route (owner, admin, staff)', () => {
    it('allows staff access', async () => {
      const token = generateToken({ ...testUser, role: 'staff' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/staff-up',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });

    it('denies read-only access', async () => {
      const token = generateToken({ ...testUser, role: 'read-only' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/staff-up',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('All-roles route (owner, admin, staff, read-only)', () => {
    const roles: TenantRole[] = ['owner', 'admin', 'staff', 'read-only'];

    for (const role of roles) {
      it(`allows ${role} access`, async () => {
        const token = generateToken({ ...testUser, role });
        const response = await server.inject({
          method: 'GET',
          url: '/test/all-roles',
          headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ access: 'granted' });
      });
    }
  });

  describe('Error handling', () => {
    it('returns 401 when no authentication token is provided', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/test/owner-only',
      });

      // authenticate middleware runs first and rejects with 401
      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('TOKEN_MISSING');
    });

    it('returns structured ApiError response on 403', async () => {
      const token = generateToken({ ...testUser, role: 'read-only' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/owner-only',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(body.error.message).toBeDefined();
      expect(body.error.request_id).toBeDefined();
    });

    it('includes the user role and required roles in error message', async () => {
      const token = generateToken({ ...testUser, role: 'staff' });
      const response = await server.inject({
        method: 'GET',
        url: '/test/owner-only',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error.message).toContain("Role 'staff'");
      expect(body.error.message).toContain('owner');
    });
  });
});
