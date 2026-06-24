import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../server.js';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
    schema: {
      users: { id: 'id', email: 'email', tenantId: 'tenant_id', passwordHash: 'password_hash', role: 'role', firstName: 'first_name', lastName: 'last_name', createdAt: 'created_at' },
      refreshTokens: { id: 'id', userId: 'user_id', token: 'token', expiresAt: 'expires_at', revoked: 'revoked', createdAt: 'created_at' },
      tenants: { id: 'id', name: 'name', subdomain: 'subdomain', subscriptionTier: 'subscription_tier', status: 'status', settings: 'settings', createdAt: 'created_at', updatedAt: 'updated_at' },
    },
    eq: vi.fn(),
    and: vi.fn(),
  };
});

import { db } from '@ecommerce/database';

describe('POST /api/v1/auth/register-merchant', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    email: 'merchant@example.com',
    password: 'SecurePass1',
    storeName: 'My Awesome Store',
    subdomain: 'my-awesome-store',
  };

  describe('Validation', () => {
    it('returns 400 for missing email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          password: 'SecurePass1',
          storeName: 'My Store',
          subdomain: 'my-store',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          email: 'not-an-email',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for weak password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          password: 'weak',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing store name', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          email: 'merchant@example.com',
          password: 'SecurePass1',
          subdomain: 'my-store',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing subdomain', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          email: 'merchant@example.com',
          password: 'SecurePass1',
          storeName: 'My Store',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Subdomain Validation', () => {
    it('returns 400 for subdomain shorter than 3 characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'ab',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for subdomain longer than 63 characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'a'.repeat(64),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for subdomain with uppercase characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'My-Store',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for subdomain starting with a hyphen', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: '-my-store',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for subdomain ending with a hyphen', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'my-store-',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for subdomain with special characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'my_store!',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts valid subdomain with hyphens', async () => {
      // Mock: no existing tenant
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      // Mock: tenant insert
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = 'user-id-123';
      let insertCallCount = 0;
      const mockReturning = vi.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{
            id: tenantId,
            name: 'My Store',
            subdomain: 'my-valid-store',
            subscriptionTier: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
          }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{
            id: userId,
            email: 'merchant@example.com',
            role: 'owner',
            tenantId,
            createdAt: new Date().toISOString(),
          }]);
        }
        // Third insert is the refresh token (no returning needed)
        return Promise.resolve([]);
      });
      (db as any).insert = mockInsert;
      (db as any).values = mockValues;
      (db as any).returning = mockReturning;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'my-valid-store',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('accepts valid 3-character subdomain', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = 'user-id-123';
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      let insertCallCount = 0;
      const mockReturning = vi.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{
            id: tenantId,
            name: 'My Store',
            subdomain: 'abc',
            subscriptionTier: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
          }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{
            id: userId,
            email: 'merchant@example.com',
            role: 'owner',
            tenantId,
            createdAt: new Date().toISOString(),
          }]);
        }
        return Promise.resolve([]);
      });
      (db as any).insert = mockInsert;
      (db as any).values = mockValues;
      (db as any).returning = mockReturning;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'abc',
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('Subdomain Uniqueness', () => {
    it('returns 409 when subdomain is already taken', async () => {
      // Mock: existing tenant found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ id: 'existing-tenant', subdomain: 'taken-store' }]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          ...validPayload,
          subdomain: 'taken-store',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe('SUBDOMAIN_TAKEN');
    });
  });

  describe('Successful Registration', () => {
    it('returns 201 with tenant, user, and tokens on success', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = 'user-id-456';

      // Mock: no existing tenant
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      // Mock: inserts (tenant, user, refresh token)
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      let insertCallCount = 0;
      const mockReturning = vi.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          // Tenant insert
          return Promise.resolve([{
            id: tenantId,
            name: 'My Awesome Store',
            subdomain: 'my-awesome-store',
            subscriptionTier: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
          }]);
        }
        if (insertCallCount === 2) {
          // User insert
          return Promise.resolve([{
            id: userId,
            email: 'merchant@example.com',
            role: 'owner',
            tenantId,
            createdAt: new Date().toISOString(),
          }]);
        }
        return Promise.resolve([]);
      });
      (db as any).insert = mockInsert;
      (db as any).values = mockValues;
      (db as any).returning = mockReturning;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: validPayload,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();

      // Verify tenant info
      expect(body.tenant).toBeDefined();
      expect(body.tenant.id).toBe(tenantId);
      expect(body.tenant.name).toBe('My Awesome Store');
      expect(body.tenant.subdomain).toBe('my-awesome-store');
      expect(body.tenant.subscriptionTier).toBe('free');
      expect(body.tenant.status).toBe('active');

      // Verify user info
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(userId);
      expect(body.user.email).toBe('merchant@example.com');
      expect(body.user.role).toBe('owner');
      expect(body.user.tenantId).toBe(tenantId);

      // Verify tokens
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBe(900);

      // Verify JWT claims
      const decoded = jwt.verify(body.accessToken, config.jwt.secret) as Record<string, unknown>;
      expect(decoded.userId).toBe(userId);
      expect(decoded.tenantId).toBe(tenantId);
      expect(decoded.role).toBe('owner');
    });

    it('creates tenant with free subscription tier', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = 'user-id-789';

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      const mockInsert = vi.fn().mockReturnThis();
      const insertedValues: unknown[] = [];
      const mockValues = vi.fn().mockImplementation((val: unknown) => {
        insertedValues.push(val);
        return db;
      });
      let insertCallCount = 0;
      const mockReturning = vi.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{
            id: tenantId,
            name: 'Test Store',
            subdomain: 'test-store',
            subscriptionTier: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
          }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{
            id: userId,
            email: 'test@example.com',
            role: 'owner',
            tenantId,
            createdAt: new Date().toISOString(),
          }]);
        }
        return Promise.resolve([]);
      });
      (db as any).insert = mockInsert;
      (db as any).values = mockValues;
      (db as any).returning = mockReturning;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          email: 'test@example.com',
          password: 'SecurePass1',
          storeName: 'Test Store',
          subdomain: 'test-store',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.tenant.subscriptionTier).toBe('free');
    });

    it('creates user with owner role', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = 'user-id-owner';

      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      let insertCallCount = 0;
      const mockReturning = vi.fn().mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return Promise.resolve([{
            id: tenantId,
            name: 'Owner Store',
            subdomain: 'owner-store',
            subscriptionTier: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
          }]);
        }
        if (insertCallCount === 2) {
          return Promise.resolve([{
            id: userId,
            email: 'owner@example.com',
            role: 'owner',
            tenantId,
            createdAt: new Date().toISOString(),
          }]);
        }
        return Promise.resolve([]);
      });
      (db as any).insert = mockInsert;
      (db as any).values = mockValues;
      (db as any).returning = mockReturning;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register-merchant',
        payload: {
          email: 'owner@example.com',
          password: 'SecurePass1',
          storeName: 'Owner Store',
          subdomain: 'owner-store',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.role).toBe('owner');
    });
  });
});
