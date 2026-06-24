import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockPromotion = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    type: 'percentage',
    value: '10.00',
    code: 'SAVE10',
    conditions: { minCartValue: 50 },
    stackingRules: { mode: 'best_only' },
    maxRedemptions: 100,
    currentRedemptions: 5,
    perCustomerLimit: 1,
    active: true,
    startsAt: new Date('2024-01-01T00:00:00Z'),
    endsAt: new Date('2025-12-31T23:59:59Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockPromotions = [
    mockPromotion,
    {
      ...mockPromotion,
      id: '22222222-2222-2222-2222-222222222222',
      type: 'fixed_amount',
      value: '5.00',
      code: 'FLAT5',
      createdAt: new Date('2024-01-02T00:00:00Z'),
    },
  ];

  // Insert mock
  const mockInsertReturning = vi.fn().mockResolvedValue([{
    ...mockPromotion,
    id: '55555555-5555-5555-5555-555555555555',
  }]);
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  // Update mock
  const mockUpdateReturning = vi.fn().mockResolvedValue([{
    ...mockPromotion,
    value: '15.00',
    updatedAt: new Date('2024-02-01T00:00:00Z'),
  }]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  // Delete mock
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  // Query mocks
  const mockFindFirst = vi.fn().mockResolvedValue(mockPromotion);
  const mockFindMany = vi.fn().mockResolvedValue(mockPromotions);

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      promotions: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
      // Other tables needed by the server bootstrapping
      products: { findFirst: vi.fn(), findMany: vi.fn() },
      listings: { findMany: vi.fn() },
      media: { findMany: vi.fn() },
    },
  };

  const schemaExports = {
    promotions: {
      id: 'id',
      tenantId: 'tenant_id',
      type: 'type',
      value: 'value',
      code: 'code',
      conditions: 'conditions',
      stackingRules: 'stacking_rules',
      maxRedemptions: 'max_redemptions',
      currentRedemptions: 'current_redemptions',
      perCustomerLimit: 'per_customer_limit',
      active: 'active',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    products: { id: 'id', tenantId: 'tenant_id', title: 'title', status: 'status', createdAt: 'created_at' },
    listings: { id: 'id', tenantId: 'tenant_id', productId: 'product_id' },
    media: { id: 'id', tenantId: 'tenant_id', productId: 'product_id', sortOrder: 'sort_order' },
  };

  return {
    db,
    schema: schemaExports,
    eq: vi.fn().mockReturnValue(true),
    and: vi.fn().mockReturnValue(true),
    or: vi.fn().mockReturnValue(true),
    ne: vi.fn().mockReturnValue(true),
    gt: vi.fn().mockReturnValue(true),
    gte: vi.fn().mockReturnValue(true),
    lt: vi.fn().mockReturnValue(true),
    lte: vi.fn().mockReturnValue(true),
    like: vi.fn().mockReturnValue(true),
    ilike: vi.fn().mockReturnValue(true),
    inArray: vi.fn().mockReturnValue(true),
    sql: vi.fn().mockReturnValue(true),
  };
});

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('Promotion Admin Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/admin/promotions', () => {
    it('should create a percentage promotion with valid input', async () => {
      const { db } = await import('@ecommerce/database');
      // Return null for duplicate code check
      (db.query.promotions.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'percentage',
          value: 10,
          code: 'SAVE10',
          conditions: { minCartValue: 50 },
          stackingRules: { mode: 'best_only' },
          maxRedemptions: 100,
          perCustomerLimit: 1,
          startsAt: '2024-01-01T00:00:00Z',
          endsAt: '2025-12-31T23:59:59Z',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.type).toBe('percentage');
    });

    it('should create a fixed_amount promotion', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'fixed_amount',
          value: 5.00,
          code: 'FLAT5',
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should create a free_shipping promotion without code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'free_shipping',
          value: 0,
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when percentage value is over 100', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'percentage',
          value: 101,
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when code is too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'percentage',
          value: 10,
          code: 'AB',
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when code contains special characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'percentage',
          value: 10,
          code: 'SAVE-10!',
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when code exceeds 32 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'percentage',
          value: 10,
          code: 'A'.repeat(33),
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when type is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'invalid_type',
          value: 10,
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 when code already exists', async () => {
      const { db } = await import('@ecommerce/database');
      // Return existing promotion for duplicate code check
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        code: 'SAVE10',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          type: 'percentage',
          value: 10,
          code: 'SAVE10',
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/promotions',
        payload: {
          type: 'percentage',
          value: 10,
          startsAt: '2024-01-01T00:00:00Z',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/admin/promotions', () => {
    it('should list promotions with default pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/promotions',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination).toHaveProperty('cursor');
      expect(body.pagination).toHaveProperty('hasMore');
    });

    it('should filter by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/promotions?type=percentage',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should filter by active status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/promotions?active=true',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when limit exceeds 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/promotions?limit=101',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/admin/promotions/:id', () => {
    it('should return a single promotion with redemption stats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/promotions/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe('11111111-1111-1111-1111-111111111111');
      expect(body.data.redemptionStats).toBeDefined();
      expect(body.data.redemptionStats.currentRedemptions).toBe(5);
      expect(body.data.redemptionStats.maxRedemptions).toBe(100);
      expect(body.data.redemptionStats.remainingRedemptions).toBe(95);
      expect(body.data.redemptionStats.perCustomerLimit).toBe(1);
    });

    it('should return 404 when promotion does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/promotions/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/promotions/invalid-id',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/v1/admin/promotions/:id', () => {
    it('should update a promotion', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/promotions/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          value: 15,
          active: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
    });

    it('should return 404 when promotion does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/promotions/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          value: 20,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/promotions/invalid-id',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          value: 20,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/v1/admin/promotions/:id', () => {
    it('should soft-delete a promotion (set active=false)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/promotions/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 when promotion does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/promotions/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/promotions/invalid-id',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
