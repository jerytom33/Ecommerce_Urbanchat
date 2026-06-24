import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockCustomers = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      totalOrders: 3,
      totalSpend: '150.00',
      averageOrderValue: '50.00',
      lastPurchaseDate: new Date('2024-01-15T00:00:00Z'),
      tags: ['vip', 'repeat'],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-15T00:00:00Z'),
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      totalOrders: 1,
      totalSpend: '75.00',
      averageOrderValue: '75.00',
      lastPurchaseDate: new Date('2024-01-10T00:00:00Z'),
      tags: [],
      createdAt: new Date('2024-01-05T00:00:00Z'),
      updatedAt: new Date('2024-01-10T00:00:00Z'),
    },
  ];

  // Insert mock
  const mockInsertReturning = vi.fn().mockResolvedValue([{
    id: '33333333-3333-3333-3333-333333333333',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'new@example.com',
    firstName: 'New',
    lastName: 'Customer',
    totalOrders: 0,
    totalSpend: '0',
    averageOrderValue: '0',
    lastPurchaseDate: null,
    tags: [],
    createdAt: new Date('2024-01-20T00:00:00Z'),
    updatedAt: new Date('2024-01-20T00:00:00Z'),
  }]);

  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  // Update mock
  const mockUpdateReturning = vi.fn().mockResolvedValue([{
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Updated',
    totalOrders: 3,
    totalSpend: '150.00',
    averageOrderValue: '50.00',
    lastPurchaseDate: new Date('2024-01-15T00:00:00Z'),
    tags: ['vip', 'repeat', 'premium'],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-20T00:00:00Z'),
  }]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  // Query mocks
  const mockFindFirst = vi.fn().mockImplementation(() => {
    return Promise.resolve(mockCustomers[0]);
  });

  const mockFindMany = vi.fn().mockImplementation(() => {
    return Promise.resolve(mockCustomers);
  });

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    query: {
      customers: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
      // Stubs for other tables needed by other route registrations
      products: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      listings: { findMany: vi.fn().mockResolvedValue([]) },
      media: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };

  const schemaExports = {
    customers: {
      id: 'id',
      tenantId: 'tenant_id',
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      totalOrders: 'total_orders',
      totalSpend: 'total_spend',
      averageOrderValue: 'average_order_value',
      lastPurchaseDate: 'last_purchase_date',
      tags: 'tags',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    products: {
      id: 'id',
      tenantId: 'tenant_id',
      title: 'title',
      status: 'status',
      createdAt: 'created_at',
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
    categories: {
      id: 'id',
      tenantId: 'tenant_id',
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

describe('Customer Management Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/admin/customers', () => {
    it('should list customers with default pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(50);
      expect(body.pagination).toHaveProperty('hasMore');
    });

    it('should accept search parameter for name/email filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers?search=john',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept page parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers?page=2',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.page).toBe(2);
    });

    it('should return 400 when limit exceeds 50', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers?limit=51',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/admin/customers/:id', () => {
    it('should return a customer profile with engagement metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.engagementMetrics).toBeDefined();
      expect(body.data.engagementMetrics.totalOrders).toBe(3);
      expect(body.data.engagementMetrics.totalSpend).toBe('150.00');
      expect(body.data.engagementMetrics.averageOrderValue).toBe('50.00');
      expect(body.data.engagementMetrics.daysSinceLastPurchase).toBeDefined();
    });

    it('should return 404 when customer does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.customers.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/customers/not-a-uuid',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/admin/customers', () => {
    it('should create a customer with valid input', async () => {
      const { db } = await import('@ecommerce/database');
      // No existing customer with this email
      (db.query.customers.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/customers',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'Customer',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.email).toBe('new@example.com');
    });

    it('should create a customer with email only', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.customers.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/customers',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          email: 'minimal@example.com',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when email is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/customers',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          firstName: 'No Email',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when email is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/customers',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          email: 'not-an-email',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 when email already exists for tenant', async () => {
      // Default mock returns existing customer
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/customers',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          email: 'john@example.com',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/customers',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/admin/customers/:id', () => {
    it('should update customer info', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/customers/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          lastName: 'Updated',
          tags: ['vip', 'repeat', 'premium'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
    });

    it('should return 404 when customer does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.customers.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/customers/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          firstName: 'Updated',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when email is invalid', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/customers/11111111-1111-1111-1111-111111111111',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          email: 'not-valid',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/customers/invalid-id',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          firstName: 'Test',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('upsertCustomerFromOrder', () => {
  it('should be exported from the customers module', async () => {
    const { upsertCustomerFromOrder } = await import('./customers.js');
    expect(upsertCustomerFromOrder).toBeDefined();
    expect(typeof upsertCustomerFromOrder).toBe('function');
  });
});
