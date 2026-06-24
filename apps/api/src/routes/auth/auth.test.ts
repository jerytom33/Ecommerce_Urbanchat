import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../server.js';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockUsers: Array<Record<string, unknown>> = [];
  const mockRefreshTokens: Array<Record<string, unknown>> = [];

  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        // Dynamic behavior set per test via __setMockData
        return Promise.resolve([]);
      }),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockImplementation(() => Promise.resolve([])),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    },
    schema: {
      users: { id: 'id', email: 'email', tenantId: 'tenant_id', passwordHash: 'password_hash', role: 'role', firstName: 'first_name', lastName: 'last_name', createdAt: 'created_at' },
      refreshTokens: { id: 'id', userId: 'user_id', token: 'token', expiresAt: 'expires_at', revoked: 'revoked', createdAt: 'created_at' },
    },
    eq: vi.fn(),
    and: vi.fn(),
    __mockUsers: mockUsers,
    __mockRefreshTokens: mockRefreshTokens,
  };
});

// Get the mocked module
import { db } from '@ecommerce/database';

describe('Auth Routes', () => {
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

  describe('POST /api/v1/auth/register', () => {
    it('returns 400 for missing email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          password: 'Test1234',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'Test1234',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password shorter than 8 characters', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Ab1',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password without uppercase letter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'test1234',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password without lowercase letter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'TEST1234',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password without a number', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'TestTest',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid tenantId format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Test1234',
          tenantId: 'not-a-uuid',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 409 when user already exists', async () => {
      // Mock db to return existing user
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{ id: 'existing-user' }]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'existing@example.com',
          password: 'Test1234',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    it('returns 201 with user data on successful registration', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = 'new-user-id-123';

      // Mock: no existing user found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;

      // Mock: insert returns new user
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([{
        id: userId,
        email: 'newuser@example.com',
        role: 'staff',
        tenantId,
        createdAt: new Date().toISOString(),
      }]);
      (db as any).insert = mockInsert;
      (db as any).values = mockValues;
      (db as any).returning = mockReturning;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'newuser@example.com',
          password: 'Test1234',
          tenantId,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user).toBeDefined();
      expect(body.user.id).toBe(userId);
      expect(body.user.email).toBe('newuser@example.com');
      expect(body.user.role).toBe('staff');
      expect(body.user.tenantId).toBe(tenantId);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 for missing email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          password: 'Test1234',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for missing password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 for non-existent user', async () => {
      // Mock: no user found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;
      (db as any).limit = mockLimit;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'Test1234',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('CorrectPass1', 12);

      // Mock: user found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: 'user-id',
        email: 'test@example.com',
        passwordHash,
        role: 'staff',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
      }]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;
      (db as any).limit = mockLimit;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'WrongPass1',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 200 with tokens on successful login', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('Test1234', 12);
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';
      const userId = 'user-id-123';

      // Mock: user found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: userId,
        email: 'test@example.com',
        passwordHash,
        role: 'admin',
        tenantId,
      }]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;
      (db as any).limit = mockLimit;

      // Mock: insert refresh token
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue([]);
      (db as any).insert = mockInsert;
      (db as any).values = mockValues;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'Test1234',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.tokenType).toBe('Bearer');
      expect(body.expiresIn).toBe(900);
      expect(body.user.id).toBe(userId);
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.role).toBe('admin');

      // Verify access token contains correct claims
      const decoded = jwt.verify(body.accessToken, config.jwt.secret) as Record<string, unknown>;
      expect(decoded.userId).toBe(userId);
      expect(decoded.tenantId).toBe(tenantId);
      expect(decoded.role).toBe('admin');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 400 for missing refreshToken', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 for invalid refresh token', async () => {
      // Mock: token not found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;
      (db as any).limit = mockLimit;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('returns 401 for revoked refresh token', async () => {
      // Mock: revoked token found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: 'token-id',
        userId: 'user-id',
        token: 'revoked-token',
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
        revoked: true,
      }]);
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhere;
      (db as any).limit = mockLimit;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'revoked-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('returns 401 for expired refresh token', async () => {
      // Mock: expired token found
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: 'token-id',
        userId: 'user-id',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 86400000), // yesterday
        revoked: false,
      }]);
      // Mock update for revoking expired token
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      // Second where call for the update
      const whereCallCount = { count: 0 };
      const mockWhereImpl = vi.fn().mockImplementation(() => {
        whereCallCount.count++;
        if (whereCallCount.count === 1) {
          // First where: select query
          return { limit: vi.fn().mockResolvedValue([{
            id: 'token-id',
            userId: 'user-id',
            token: 'expired-token',
            expiresAt: new Date(Date.now() - 86400000),
            revoked: false,
          }]) };
        }
        // Subsequent where: update query
        return Promise.resolve([]);
      });
      (db as any).select = mockSelect;
      (db as any).from = mockFrom;
      (db as any).where = mockWhereImpl;
      (db as any).limit = mockLimit;
      (db as any).update = mockUpdate;
      (db as any).set = mockSet;

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: 'expired-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });
});
