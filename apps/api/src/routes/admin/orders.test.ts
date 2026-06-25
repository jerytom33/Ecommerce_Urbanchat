import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const LISTING_ID = '11111111-1111-1111-1111-111111111111';

// Mock the cart store (required by cart route registration)
vi.mock('../../services/cart-store.js', () => ({
  getCart: vi.fn().mockReturnValue([]),
  clearCart: vi.fn().mockReturnValue(true),
  startReservationCleanup: vi.fn(),
  stopReservationCleanup: vi.fn(),
  addToCart: vi.fn().mockReturnValue({ success: true }),
  removeFromCart: vi.fn().mockReturnValue(true),
  updateItemQuantity: vi.fn().mockReturnValue({ success: true }),
  RESERVATION_TTL_MS: 15 * 60 * 1000,
}));

// Mock the upsertCustomerFromOrder function
vi.mock('./customers.js', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    upsertCustomerFromOrder: vi.fn().mockResolvedValue({
      id: 'cust-1',
      email: 'test@example.com',
      totalOrders: 1,
      totalSpend: '100.00',
      averageOrderValue: '100.00',
      lastPurchaseDate: new Date(),
    }),
  };
});

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockOrder = {
    id: '33333333-3333-3333-3333-333333333333',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    customerId: null,
    status: 'confirmed',
    subtotal: '59.98',
    tax: '4.80',
    shipping: '5.99',
    discount: '0.00',
    total: '70.77',
    currency: 'USD',
    shippingAddress: { line1: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
    billingAddress: { line1: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockOrderLineItem = {
    id: '44444444-4444-4444-4444-444444444444',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    orderId: '33333333-3333-3333-3333-333333333333',
    listingId: '11111111-1111-1111-1111-111111111111',
    title: 'Test Product',
    sku: 'SKU-001',
    quantity: 2,
    unitPrice: '29.99',
    fulfillmentStatus: 'pending',
    carrierName: null,
    trackingNumber: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockFindFirst = vi.fn().mockResolvedValue(null);
  const mockFindMany = vi.fn().mockResolvedValue([]);

  const mockInsertReturning = vi.fn().mockResolvedValue([mockOrder]);
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockUpdateReturning = vi.fn().mockResolvedValue([mockOrder]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    query: {
      listings: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      products: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      orders: { findFirst: vi.fn().mockResolvedValue(mockOrder), findMany: vi.fn().mockResolvedValue([mockOrder]) },
      orderLineItems: { findFirst: vi.fn().mockResolvedValue(mockOrderLineItem), findMany: vi.fn().mockResolvedValue([mockOrderLineItem]) },
      promotions: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      categories: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      customers: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      tenants: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      users: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      refreshTokens: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      themes: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
      media: { findFirst: vi.fn().mockResolvedValue(null), findMany: mockFindMany },
    },
  };

  return {
    db,
    schema: {
      listings: { id: 'id', tenantId: 'tenant_id', productId: 'product_id', inventoryQuantity: 'inventory_quantity', status: 'status' },
      products: { id: 'id', tenantId: 'tenant_id' },
      orders: { id: 'id', tenantId: 'tenant_id', status: 'status', createdAt: 'created_at' },
      orderLineItems: { id: 'id', tenantId: 'tenant_id', orderId: 'order_id', listingId: 'listing_id' },
      promotions: { tenantId: 'tenant_id', code: 'code' },
      categories: { id: 'id', tenantId: 'tenant_id' },
      customers: { id: 'id', tenantId: 'tenant_id', email: 'email' },
      tenants: { id: 'id' },
      users: { id: 'id' },
      refreshTokens: { id: 'id' },
      themes: { id: 'id', tenantId: 'tenant_id' },
      media: { id: 'id' },
    },
    eq: vi.fn().mockReturnValue(true),
    and: vi.fn().mockReturnValue(true),
    or: vi.fn().mockReturnValue(true),
    sql: vi.fn().mockReturnValue('sql'),
    ilike: vi.fn().mockReturnValue(true),
    inArray: vi.fn().mockReturnValue(true),
  };
});

describe('Admin Order Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildServer({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/admin/orders', () => {
    it('should list orders with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].id).toBe(ORDER_ID);
      expect(body.data[0].status).toBe('confirmed');
      expect(body.data[0].total).toBe('70.77');
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
    });

    it('should accept page and limit query params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders?page=2&limit=10',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
    });

    it('should accept status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders?status=confirmed',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 401 without tenant context', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/admin/orders/:id', () => {
    it('should return order with line items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/orders/${ORDER_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(ORDER_ID);
      expect(body.data.status).toBe('confirmed');
      expect(body.data.total).toBe('70.77');
      expect(body.data.lineItems).toHaveLength(1);
      expect(body.data.lineItems[0].title).toBe('Test Product');
      expect(body.data.lineItems[0].sku).toBe('SKU-001');
      expect(body.data.lineItems[0].quantity).toBe(2);
      expect(body.data.lineItems[0].unitPrice).toBe('29.99');
      expect(body.data.shippingAddress).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.orders.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return 400 for invalid order ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/not-a-uuid',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
