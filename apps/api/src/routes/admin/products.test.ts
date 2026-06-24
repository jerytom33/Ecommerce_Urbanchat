import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockProducts = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Test Product 1',
      description: 'A test product',
      status: 'draft',
      categoryId: null,
      metadata: {},
      createdAt: new Date('2024-01-02T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Test Product 2',
      description: null,
      status: 'active',
      categoryId: null,
      metadata: {},
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
  ];

  const mockListings = [
    {
      id: '33333333-3333-3333-3333-333333333333',
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      productId: '11111111-1111-1111-1111-111111111111',
      sku: 'SKU-001',
      price: '19.99',
      weight: 500,
      inventoryQuantity: 10,
      options: {},
      status: 'active',
      createdAt: new Date('2024-01-02T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    },
  ];

  const mockMedia = [
    {
      id: '44444444-4444-4444-4444-444444444444',
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      productId: '11111111-1111-1111-1111-111111111111',
      url: 'https://cdn.example.com/image1.jpg',
      altText: 'Product image',
      mimeType: 'image/jpeg',
      size: 12345,
      sortOrder: 0,
      createdAt: new Date('2024-01-02T00:00:00Z'),
    },
  ];

  // Insert mock
  const mockInsertReturning = vi.fn().mockResolvedValue([{
    id: '55555555-5555-5555-5555-555555555555',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'New Product',
    description: null,
    status: 'draft',
    categoryId: null,
    metadata: {},
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  }]);

  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  // Update mock
  const mockUpdateReturning = vi.fn().mockResolvedValue([{
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'Updated Product',
    description: 'Updated description',
    status: 'active',
    categoryId: null,
    metadata: {},
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  }]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  // Query mocks
  const mockFindFirst = vi.fn().mockImplementation(({ where }: any) => {
    // Default: return the first product
    return Promise.resolve(mockProducts[0]);
  });

  const mockFindMany = vi.fn().mockImplementation(() => {
    return Promise.resolve(mockProducts);
  });

  const mockListingsFindMany = vi.fn().mockResolvedValue(mockListings);
  const mockMediaFindMany = vi.fn().mockResolvedValue(mockMedia);

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    query: {
      products: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
      listings: {
        findMany: mockListingsFindMany,
      },
      media: {
        findMany: mockMediaFindMany,
      },
    },
  };

  // Schema exports (match the real schema structure for type satisfaction)
  const schemaExports = {
    products: {
      id: 'id',
      tenantId: 'tenant_id',
      title: 'title',
      description: 'description',
      status: 'status',
      categoryId: 'category_id',
      metadata: 'metadata',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    listings: {
      id: 'id',
      tenantId: 'tenant_id',
      productId: 'product_id',
    },
    media: {
      id: 'id',
      tenantId: 'tenant_id',
      productId: 'product_id',
      sortOrder: 'sort_order',
    },
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

describe('Product CRUD Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/admin/products', () => {
    it('should create a product with valid input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'New Product',
          description: 'A great product',
          status: 'draft',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.title).toBe('New Product');
    });

    it('should create a product with minimal fields (title only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'Minimal Product',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when title is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          description: 'No title here',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
      expect(body.error.details.length).toBeGreaterThan(0);
    });

    it('should return 400 when title exceeds 255 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'a'.repeat(256),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when title is empty string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when description exceeds 10,000 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'Good Title',
          description: 'x'.repeat(10001),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when status is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'Good Title',
          status: 'invalid_status',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when categoryId is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'Good Title',
          categoryId: 'not-a-uuid',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/products',
        payload: {
          title: 'Product Without Tenant',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/admin/products', () => {
    it('should list products with default pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products',
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

    it('should accept limit query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products?limit=5',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products?status=active',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept search parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products?search=test',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when limit exceeds 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products?limit=101',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when limit is 0', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products?limit=0',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when cursor is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products?cursor=invalid',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/admin/products/:id', () => {
    it('should return a product with listings and media', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.listings).toBeDefined();
      expect(body.data.media).toBeDefined();
    });

    it('should return 404 when product does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.products.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/products/not-a-uuid',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/v1/admin/products/:id', () => {
    it('should update a product with partial fields', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/products/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'Updated Product',
          status: 'active',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
    });

    it('should update with only description', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/products/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          description: 'Updated description only',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 when product does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.products.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/products/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'Updated Product',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when title exceeds max length', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/products/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          title: 'a'.repeat(256),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow setting description to null', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/products/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          description: null,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('DELETE /api/v1/admin/products/:id', () => {
    it('should soft delete (archive) a product', async () => {
      const { db } = await import('@ecommerce/database');
      const mockUpdateReturning = vi.fn().mockResolvedValue([{
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: TENANT_ID,
        title: 'Test Product 1',
        description: 'A test product',
        status: 'archived',
        categoryId: null,
        metadata: {},
        createdAt: new Date('2024-01-02T00:00:00Z'),
        updatedAt: new Date('2024-01-03T00:00:00Z'),
      }]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
      const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as any).mockReturnValue({ set: mockUpdateSet });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/products/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('archived');
    });

    it('should return 404 when product does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.products.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/products/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/products/invalid-id',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
