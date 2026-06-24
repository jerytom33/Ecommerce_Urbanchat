import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockProduct = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'Test Product',
    description: 'A test product',
    status: 'draft',
    categoryId: null,
    metadata: {},
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  const mockListing = {
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
  };

  const mockListings = [mockListing];

  // Insert mock
  const mockInsertReturning = vi.fn().mockResolvedValue([{
    id: '55555555-5555-5555-5555-555555555555',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    productId: '11111111-1111-1111-1111-111111111111',
    sku: 'SKU-NEW',
    price: '29.99',
    weight: 300,
    inventoryQuantity: 5,
    options: {},
    status: 'active',
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  }]);
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  // Update mock
  const mockUpdateReturning = vi.fn().mockResolvedValue([{
    id: '33333333-3333-3333-3333-333333333333',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    productId: '11111111-1111-1111-1111-111111111111',
    sku: 'SKU-UPDATED',
    price: '39.99',
    weight: 600,
    inventoryQuantity: 20,
    options: {},
    status: 'active',
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  }]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  // Delete mock
  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  // Query mocks
  const mockProductsFindFirst = vi.fn().mockResolvedValue(mockProduct);
  const mockProductsFindMany = vi.fn().mockResolvedValue([mockProduct]);

  const mockListingsFindFirst = vi.fn().mockResolvedValue(mockListing);
  const mockListingsFindMany = vi.fn().mockResolvedValue(mockListings);

  const mockMediaFindMany = vi.fn().mockResolvedValue([]);

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      products: {
        findFirst: mockProductsFindFirst,
        findMany: mockProductsFindMany,
      },
      listings: {
        findFirst: mockListingsFindFirst,
        findMany: mockListingsFindMany,
      },
      media: {
        findMany: mockMediaFindMany,
      },
    },
  };

  // Schema exports
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
      sku: 'sku',
      price: 'price',
      weight: 'weight',
      inventoryQuantity: 'inventory_quantity',
      options: 'options',
      status: 'status',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
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
const PRODUCT_ID = '11111111-1111-1111-1111-111111111111';
const LISTING_ID = '33333333-3333-3333-3333-333333333333';

describe('Listing CRUD Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/admin/products/:productId/listings', () => {
    it('should create a listing with valid input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-NEW',
          price: 29.99,
          weight: 300,
          inventoryQuantity: 5,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.sku).toBe('SKU-NEW');
    });

    it('should create a listing with minimal fields (sku and price only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-MINIMAL',
          price: 9.99,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when SKU is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          price: 10.00,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when price is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-NOPRICE',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when price is below minimum (0.01)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-LOWPRICE',
          price: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when price exceeds maximum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-HIGHPRICE',
          price: 1000000000,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when SKU exceeds 64 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'a'.repeat(65),
          price: 10.00,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when weight exceeds maximum (1,000,000)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-HEAVY',
          price: 10.00,
          weight: 1000001,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when inventoryQuantity exceeds maximum (999,999)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-OVERSTOCK',
          price: 10.00,
          inventoryQuantity: 1000000,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when product does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.products.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/99999999-9999-9999-9999-999999999999/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-ORPHAN',
          price: 10.00,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when product already has 100 listings', async () => {
      const { db } = await import('@ecommerce/database');
      const hundredListings = Array.from({ length: 100 }, (_, i) => ({
        id: `listing-${i}`,
        sku: `SKU-${i}`,
      }));
      (db.query.listings.findMany as any).mockResolvedValueOnce(hundredListings);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-101',
          price: 10.00,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MAX_LISTINGS_EXCEEDED');
    });

    it('should return 409 on duplicate SKU within tenant', async () => {
      const { db } = await import('@ecommerce/database');
      const duplicateError = new Error('duplicate key value violates unique constraint');
      (duplicateError as any).code = '23505';
      (duplicateError as any).constraint_name = 'listings_tenant_id_sku_unique';
      const mockInsertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValueOnce(duplicateError),
      });
      (db.insert as any).mockReturnValueOnce({ values: mockInsertValues });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-001',
          price: 10.00,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('DUPLICATE_SKU');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        payload: {
          sku: 'SKU-NOAUTH',
          price: 10.00,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 when productId is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/products/not-a-uuid/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-BADID',
          price: 10.00,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/admin/products/:productId/listings', () => {
    it('should list all listings for a product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should return 404 when product does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.products.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/99999999-9999-9999-9999-999999999999/listings`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/products/${PRODUCT_ID}/listings`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/admin/listings/:id', () => {
    it('should update a listing with partial fields', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/listings/${LISTING_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-UPDATED',
          price: 39.99,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
    });

    it('should update only inventory quantity', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/listings/${LISTING_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          inventoryQuantity: 50,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 when listing does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.listings.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/listings/99999999-9999-9999-9999-999999999999`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          price: 15.00,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 409 on duplicate SKU when updating', async () => {
      const { db } = await import('@ecommerce/database');
      const duplicateError = new Error('duplicate key value violates unique constraint');
      (duplicateError as any).code = '23505';
      (duplicateError as any).constraint_name = 'listings_tenant_id_sku_unique';
      const mockUpdateReturning = vi.fn().mockRejectedValueOnce(duplicateError);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
      const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      (db.update as any).mockReturnValueOnce({ set: mockUpdateSet });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/listings/${LISTING_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          sku: 'SKU-EXISTING',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('DUPLICATE_SKU');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/listings/not-a-uuid`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          price: 15.00,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when price is below minimum', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/listings/${LISTING_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          price: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/listings/${LISTING_ID}`,
        payload: {
          price: 15.00,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/admin/listings/:id', () => {
    it('should hard delete a listing', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/listings/${LISTING_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 when listing does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.listings.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/listings/99999999-9999-9999-9999-999999999999`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/listings/invalid-id`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/listings/${LISTING_ID}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
