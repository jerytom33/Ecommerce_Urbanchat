import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SESSION_ID = 'test-session-123';
const LISTING_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

// Mock the cart store
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
vi.mock('../admin/customers.js', async (importOriginal) => {
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
  const mockListing = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    productId: '22222222-2222-2222-2222-222222222222',
    sku: 'SKU-001',
    price: '29.99',
    inventoryQuantity: 50,
    status: 'active',
    options: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: '22222222-2222-2222-2222-222222222222',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'Test Product',
    description: 'A test product',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
  };

  const mockFindFirst = vi.fn().mockImplementation(() => Promise.resolve(null));
  const mockFindMany = vi.fn().mockResolvedValue([]);

  const mockInsertReturning = vi.fn().mockResolvedValue([mockOrder]);
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockUpdateReturning = vi.fn().mockResolvedValue([mockListing]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    query: {
      listings: { findFirst: vi.fn().mockResolvedValue(mockListing), findMany: mockFindMany },
      products: { findFirst: vi.fn().mockResolvedValue(mockProduct), findMany: mockFindMany },
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

  // Export mock data for tests to access
  (db as any).__mockListing = mockListing;
  (db as any).__mockProduct = mockProduct;
  (db as any).__mockOrder = mockOrder;
  (db as any).__mockOrderLineItem = mockOrderLineItem;

  return {
    db,
    schema: {
      listings: { id: 'id', tenantId: 'tenant_id', productId: 'product_id', inventoryQuantity: 'inventory_quantity', status: 'status', sku: 'sku', price: 'price' },
      products: { id: 'id', tenantId: 'tenant_id', title: 'title' },
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

describe('Checkout Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildServer({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/storefront/checkout/initiate', () => {
    it('should return 400 when cart is empty', async () => {
      const { getCart } = await import('../../services/cart-store.js');
      (getCart as any).mockReturnValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/initiate',
        headers: { 'x-tenant-id': TENANT_ID, 'x-session-id': SESSION_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('EMPTY_CART');
    });

    it('should return price breakdown when cart has items', async () => {
      const { getCart } = await import('../../services/cart-store.js');
      (getCart as any).mockReturnValue([
        { listingId: LISTING_ID, quantity: 2, reservedAt: Date.now() },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/initiate',
        headers: { 'x-tenant-id': TENANT_ID, 'x-session-id': SESSION_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.lineItems).toHaveLength(1);
      expect(body.data.lineItems[0].unitPrice).toBe('29.99');
      expect(body.data.lineItems[0].quantity).toBe(2);
      expect(body.data.lineItems[0].lineTotal).toBe('59.98');
      expect(body.data.subtotal).toBe('59.98');
      // Tax: 59.98 * 0.08 = 4.80 (rounded)
      expect(body.data.tax).toBe('4.80');
      expect(body.data.shipping).toBe('5.99');
      expect(body.data.discount).toBe('0.00');
      // Total: 59.98 + 4.80 + 5.99 - 0 = 70.77
      expect(body.data.total).toBe('70.77');
      expect(body.data.currency).toBe('USD');
    });

    it('should return 400 when x-session-id header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/initiate',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MISSING_SESSION');
    });

    it('should return 401 when x-tenant-id header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/initiate',
        headers: { 'x-session-id': SESSION_ID },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/storefront/checkout/pay', () => {
    const validPayload = {
      email: 'customer@example.com',
      shippingAddress: {
        line1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        country: 'US',
      },
      paymentMethod: {
        type: 'card',
        last4: '4242',
        brand: 'Visa',
      },
    };

    it('should decline payment when last4 is 0000', async () => {
      const { getCart } = await import('../../services/cart-store.js');
      (getCart as any).mockReturnValue([
        { listingId: LISTING_ID, quantity: 2, reservedAt: Date.now() },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers: { 'x-tenant-id': TENANT_ID, 'x-session-id': SESSION_ID },
        payload: {
          ...validPayload,
          paymentMethod: { type: 'card', last4: '0000', brand: 'Visa' },
        },
      });

      expect(response.statusCode).toBe(402);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PAYMENT_DECLINED');
      expect(body.error.message).toBe('Card declined');
      expect(body.error.nextSteps).toBeDefined();
    });

    it('should create order on successful payment', async () => {
      const { getCart, clearCart } = await import('../../services/cart-store.js');
      (getCart as any).mockReturnValue([
        { listingId: LISTING_ID, quantity: 2, reservedAt: Date.now() },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers: { 'x-tenant-id': TENANT_ID, 'x-session-id': SESSION_ID },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.orderId).toBe(ORDER_ID);
      expect(body.data.status).toBe('confirmed');
      expect(body.data.email).toBe('customer@example.com');
      expect(body.data.paymentMethod.last4).toBe('4242');
      expect(body.data.paymentMethod.brand).toBe('Visa');
      expect(body.data.shippingAddress).toEqual(validPayload.shippingAddress);
      expect(clearCart).toHaveBeenCalledWith(SESSION_ID);
    });

    it('should return 400 when cart is empty', async () => {
      const { getCart } = await import('../../services/cart-store.js');
      (getCart as any).mockReturnValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers: { 'x-tenant-id': TENANT_ID, 'x-session-id': SESSION_ID },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('EMPTY_CART');
    });

    it('should return 400 for invalid email', async () => {
      const { getCart } = await import('../../services/cart-store.js');
      (getCart as any).mockReturnValue([
        { listingId: LISTING_ID, quantity: 1, reservedAt: Date.now() },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers: { 'x-tenant-id': TENANT_ID, 'x-session-id': SESSION_ID },
        payload: { ...validPayload, email: 'not-an-email' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid last4 format', async () => {
      const { getCart } = await import('../../services/cart-store.js');
      (getCart as any).mockReturnValue([
        { listingId: LISTING_ID, quantity: 1, reservedAt: Date.now() },
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers: { 'x-tenant-id': TENANT_ID, 'x-session-id': SESSION_ID },
        payload: {
          ...validPayload,
          paymentMethod: { type: 'card', last4: 'abcd', brand: 'Visa' },
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/storefront/checkout/orders/:id', () => {
    it('should return order details with line items', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/storefront/checkout/orders/${ORDER_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(ORDER_ID);
      expect(body.data.status).toBe('confirmed');
      expect(body.data.lineItems).toHaveLength(1);
      expect(body.data.lineItems[0].title).toBe('Test Product');
      expect(body.data.lineItems[0].quantity).toBe(2);
    });

    it('should return 404 for non-existent order', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.orders.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/checkout/orders/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('should return 400 for invalid order ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/checkout/orders/not-a-uuid',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
