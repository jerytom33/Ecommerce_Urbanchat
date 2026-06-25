import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { resetCartStore, stopReservationCleanup } from '../../services/cart-store.js';
import { errorHandlerPlugin } from '../../plugins/error-handler.js';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SESSION_ID = 'integration-session-001';
const LISTING_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';

const mockListing = {
  id: LISTING_ID,
  tenantId: TENANT_ID,
  productId: PRODUCT_ID,
  sku: 'WIDGET-RED-M',
  price: '49.99',
  weight: 350,
  inventoryQuantity: 100,
  options: { color: 'red', size: 'M' },
  status: 'active',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockProduct = {
  id: PRODUCT_ID,
  tenantId: TENANT_ID,
  title: 'Red Widget',
  description: 'A premium red widget',
  status: 'active',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockOrder = {
  id: ORDER_ID,
  tenantId: TENANT_ID,
  customerId: null,
  status: 'confirmed',
  subtotal: '149.97',
  tax: '12.00',
  shipping: '5.99',
  discount: '0.00',
  total: '167.96',
  currency: 'USD',
  shippingAddress: { line1: '456 Elm St', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
  billingAddress: { line1: '456 Elm St', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
  createdAt: new Date('2024-06-15T10:30:00Z'),
  updatedAt: new Date('2024-06-15T10:30:00Z'),
};

// ─── Database Mock ───────────────────────────────────────────────────────────

const mockInsertReturning = vi.fn().mockResolvedValue([mockOrder]);
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockUpdateReturning = vi.fn().mockResolvedValue([mockListing]);
const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock('@ecommerce/database', () => {
  return {
    db: {
      insert: mockInsert,
      update: mockUpdate,
      query: {
        listings: { findFirst: vi.fn().mockResolvedValue(mockListing), findMany: vi.fn().mockResolvedValue([]) },
        products: { findFirst: vi.fn().mockResolvedValue(mockProduct), findMany: vi.fn().mockResolvedValue([]) },
        orders: { findFirst: vi.fn().mockResolvedValue(mockOrder), findMany: vi.fn().mockResolvedValue([mockOrder]) },
        orderLineItems: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        promotions: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        categories: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        customers: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        tenants: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        users: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        refreshTokens: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        themes: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
        media: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      },
    },
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

// Mock upsertCustomerFromOrder (non-critical CRM side-effect)
vi.mock('../admin/customers.js', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    upsertCustomerFromOrder: vi.fn().mockResolvedValue({
      id: 'cust-integration-1',
      email: 'buyer@example.com',
      totalOrders: 1,
      totalSpend: '167.96',
      averageOrderValue: '167.96',
      lastPurchaseDate: new Date(),
    }),
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const headers = {
  'x-tenant-id': TENANT_ID,
  'x-session-id': SESSION_ID,
};

const validPaymentPayload = {
  email: 'buyer@example.com',
  shippingAddress: {
    line1: '456 Elm St',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    country: 'US',
  },
  paymentMethod: {
    type: 'card' as const,
    last4: '4242',
    brand: 'Visa',
  },
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Checkout Flow Integration', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetCartStore();

    app = Fastify({ logger: false });
    errorHandlerPlugin(app);

    // Register both cart and checkout routes to test them working together
    const { cartRoutes } = await import('./cart.js');
    const { checkoutRoutes } = await import('./checkout.js');
    await app.register(cartRoutes, { prefix: '/api/v1/storefront/cart' });
    await app.register(checkoutRoutes, { prefix: '/api/v1/storefront/checkout' });
    await app.ready();
  });

  afterEach(async () => {
    stopReservationCleanup();
    resetCartStore();
    await app.close();
  });

  describe('Full checkout happy path', () => {
    it('should complete end-to-end: add to cart → verify cart → initiate → pay → cart cleared', async () => {
      // ─── Step 1: Add item to cart ───────────────────────────────────
      const addResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers,
        payload: { listingId: LISTING_ID, quantity: 3 },
      });

      expect(addResponse.statusCode).toBe(200);
      const addBody = JSON.parse(addResponse.body);
      expect(addBody.data.items).toHaveLength(1);
      expect(addBody.data.items[0].listingId).toBe(LISTING_ID);
      expect(addBody.data.items[0].quantity).toBe(3);

      // ─── Step 2: Verify cart has the item ───────────────────────────
      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/cart',
        headers,
      });

      expect(cartResponse.statusCode).toBe(200);
      const cartBody = JSON.parse(cartResponse.body);
      expect(cartBody.data.items).toHaveLength(1);
      expect(cartBody.data.items[0].listingId).toBe(LISTING_ID);
      expect(cartBody.data.items[0].quantity).toBe(3);
      expect(cartBody.data.itemCount).toBe(1);
      // Price: 49.99 × 3 = 149.97
      expect(cartBody.data.subtotal).toBe('149.97');

      // ─── Step 3: Initiate checkout — verify price calculation ───────
      const initiateResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/initiate',
        headers,
      });

      expect(initiateResponse.statusCode).toBe(200);
      const initiateBody = JSON.parse(initiateResponse.body);
      expect(initiateBody.data.lineItems).toHaveLength(1);
      expect(initiateBody.data.lineItems[0].title).toBe('Red Widget');
      expect(initiateBody.data.lineItems[0].unitPrice).toBe('49.99');
      expect(initiateBody.data.lineItems[0].quantity).toBe(3);
      expect(initiateBody.data.lineItems[0].lineTotal).toBe('149.97');
      expect(initiateBody.data.subtotal).toBe('149.97');
      // Tax: 149.97 * 0.08 = 12.00 (rounded)
      expect(initiateBody.data.tax).toBe('12.00');
      expect(initiateBody.data.shipping).toBe('5.99');
      expect(initiateBody.data.discount).toBe('0.00');
      // Total: 149.97 + 12.00 + 5.99 = 167.96
      expect(initiateBody.data.total).toBe('167.96');
      expect(initiateBody.data.currency).toBe('USD');

      // ─── Step 4: Process payment — verify order created ─────────────
      const payResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers,
        payload: validPaymentPayload,
      });

      expect(payResponse.statusCode).toBe(201);
      const payBody = JSON.parse(payResponse.body);
      expect(payBody.data.orderId).toBe(ORDER_ID);
      expect(payBody.data.status).toBe('confirmed');
      expect(payBody.data.email).toBe('buyer@example.com');
      expect(payBody.data.total).toBe('167.96');
      expect(payBody.data.currency).toBe('USD');
      expect(payBody.data.shippingAddress).toEqual(validPaymentPayload.shippingAddress);
      expect(payBody.data.paymentMethod.last4).toBe('4242');
      expect(payBody.data.paymentMethod.brand).toBe('Visa');

      // ─── Step 5: Verify cart is cleared after successful payment ────
      const clearedCartResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/cart',
        headers,
      });

      expect(clearedCartResponse.statusCode).toBe(200);
      const clearedBody = JSON.parse(clearedCartResponse.body);
      expect(clearedBody.data.items).toHaveLength(0);
      expect(clearedBody.data.itemCount).toBe(0);
      expect(clearedBody.data.subtotal).toBe('0.00');
    });
  });

  describe('Payment decline — reservation released', () => {
    it('should decline payment with last4=0000 and keep cart items (reservation intact)', async () => {
      // Add item to cart
      const addResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers,
        payload: { listingId: LISTING_ID, quantity: 2 },
      });
      expect(addResponse.statusCode).toBe(200);

      // Attempt payment with declined card
      const payResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers,
        payload: {
          ...validPaymentPayload,
          paymentMethod: { type: 'card', last4: '0000', brand: 'Visa' },
        },
      });

      expect(payResponse.statusCode).toBe(402);
      const payBody = JSON.parse(payResponse.body);
      expect(payBody.error.code).toBe('PAYMENT_DECLINED');
      expect(payBody.error.message).toBe('Card declined');
      expect(payBody.error.nextSteps).toBeDefined();

      // Cart should still have items (payment was declined, cart not cleared)
      const cartResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/cart',
        headers,
      });

      expect(cartResponse.statusCode).toBe(200);
      const cartBody = JSON.parse(cartResponse.body);
      expect(cartBody.data.items).toHaveLength(1);
      expect(cartBody.data.items[0].listingId).toBe(LISTING_ID);
      expect(cartBody.data.items[0].quantity).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should return 400 when initiating checkout with empty cart', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/initiate',
        headers,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('EMPTY_CART');
    });

    it('should return 400 when paying with empty cart', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers,
        payload: validPaymentPayload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('EMPTY_CART');
    });

    it('should return 400 for payment with invalid email', async () => {
      // Add item to cart first
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers,
        payload: { listingId: LISTING_ID, quantity: 1 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers,
        payload: {
          ...validPaymentPayload,
          email: 'not-a-valid-email',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for payment with missing shipping address', async () => {
      // Add item to cart first
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers,
        payload: { listingId: LISTING_ID, quantity: 1 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/checkout/pay',
        headers,
        payload: {
          email: 'buyer@example.com',
          paymentMethod: { type: 'card', last4: '4242', brand: 'Visa' },
          // Missing shippingAddress entirely
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
