import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockExecute = vi.fn().mockResolvedValue([]);

  const db = {
    execute: mockExecute,
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    query: {
      products: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      listings: { findMany: vi.fn().mockResolvedValue([]) },
      media: { findMany: vi.fn().mockResolvedValue([]) },
      categories: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      customers: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      tenants: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      themes: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      promotions: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    },
  };

  const schemaExports = {
    products: { id: 'id', tenantId: 'tenant_id', title: 'title', description: 'description', status: 'status', categoryId: 'category_id', metadata: 'metadata', createdAt: 'created_at', updatedAt: 'updated_at' },
    listings: { id: 'id', tenantId: 'tenant_id', productId: 'product_id' },
    media: { id: 'id', tenantId: 'tenant_id', productId: 'product_id', sortOrder: 'sort_order' },
    categories: { id: 'id', tenantId: 'tenant_id' },
    tenants: { id: 'id' },
    customers: { id: 'id', tenantId: 'tenant_id' },
    themes: { id: 'id', tenantId: 'tenant_id' },
    promotions: { id: 'id', tenantId: 'tenant_id', code: 'code', active: 'active', startsAt: 'starts_at', endsAt: 'ends_at' },
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

describe('Storefront Search Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/storefront/search', () => {
    it('should return search results with pagination metadata', async () => {
      const { db } = await import('@ecommerce/database');
      // First call: search results, second call: count
      (db.execute as any)
        .mockResolvedValueOnce([
          { id: '11111111-1111-1111-1111-111111111111', title: 'Blue Running Shoes', relevance: 0.8 },
          { id: '22222222-2222-2222-2222-222222222222', title: 'Red Running Shoes', relevance: 0.6 },
        ])
        .mockResolvedValueOnce([{ total: '2' }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=shoes',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(2);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.totalPages).toBe(1);
      expect(body.pagination.hasMore).toBe(false);
    });

    it('should return empty array with total 0 for no matches', async () => {
      const { db } = await import('@ecommerce/database');
      (db.execute as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=nonexistent',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.totalPages).toBe(0);
      expect(body.pagination.hasMore).toBe(false);
    });

    it('should support pagination with page parameter', async () => {
      const { db } = await import('@ecommerce/database');
      (db.execute as any)
        .mockResolvedValueOnce([{ id: '33333333-3333-3333-3333-333333333333', title: 'Page 2 Shoe' }])
        .mockResolvedValueOnce([{ total: '25' }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=shoe&page=2&limit=20',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.totalPages).toBe(2);
      expect(body.pagination.hasMore).toBe(false);
    });

    it('should set hasMore to true when more pages exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.execute as any)
        .mockResolvedValueOnce([{ id: '44444444-4444-4444-4444-444444444444', title: 'First Shoe' }])
        .mockResolvedValueOnce([{ total: '45' }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=shoe&page=1&limit=20',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.totalPages).toBe(3);
      expect(body.pagination.hasMore).toBe(true);
    });

    it('should enforce max 50 results per page', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=shoes&limit=51',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for whitespace-only query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=   ',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when q parameter is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should use default page=1 and limit=20', async () => {
      const { db } = await import('@ecommerce/database');
      (db.execute as any)
        .mockResolvedValueOnce([{ id: '11111111-1111-1111-1111-111111111111', title: 'Shoes' }])
        .mockResolvedValueOnce([{ total: '1' }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=shoes',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.page).toBe(1);
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=shoes',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should fall back to ILIKE search when full-text search fails', async () => {
      const { db } = await import('@ecommerce/database');
      // First call (full-text) throws, then fallback ILIKE calls succeed
      (db.execute as any)
        .mockRejectedValueOnce(new Error('syntax error in tsquery'))
        .mockResolvedValueOnce([{ id: '11111111-1111-1111-1111-111111111111', title: 'Shoes', relevance: 3 }])
        .mockResolvedValueOnce([{ total: '1' }]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search?q=shoes',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });
  });

  describe('GET /api/v1/storefront/search/suggest', () => {
    it('should return autocomplete suggestions', async () => {
      const { db } = await import('@ecommerce/database');
      (db.execute as any).mockResolvedValueOnce([
        { title: 'Blue Running Shoes' },
        { title: 'Blue Sneakers' },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search/suggest?q=Bl',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toEqual(['Blue Running Shoes', 'Blue Sneakers']);
    });

    it('should return max 10 suggestions', async () => {
      const { db } = await import('@ecommerce/database');
      const manySuggestions = Array.from({ length: 10 }, (_, i) => ({ title: `Product ${i + 1}` }));
      (db.execute as any).mockResolvedValueOnce(manySuggestions);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search/suggest?q=Pr',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeLessThanOrEqual(10);
    });

    it('should return 400 when query is less than 2 characters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search/suggest?q=a',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when q parameter is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search/suggest',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty array when no matches found', async () => {
      const { db } = await import('@ecommerce/database');
      (db.execute as any).mockResolvedValueOnce([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search/suggest?q=xyz',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/search/suggest?q=shoes',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
