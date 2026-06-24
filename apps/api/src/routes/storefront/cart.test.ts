import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { resetCartStore, stopReservationCleanup } from '../../services/cart-store.js';
import { errorHandlerPlugin } from '../../plugins/error-handler.js';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockListing = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    productId: '22222222-2222-2222-2222-222222222222',
    sku: 'SKU-001',
    price: '29.99',
    weight: 500,
    inventoryQuantity: 50,
    options: { color: 'red' },
    status: 'active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockListingsFindFirst = vi.fn().mockImplementation(() => {
    return Promise.resolve(mockListing);
  });

  const db = {
    query: {
      listings: {
        findFirst: mockListingsFindFirst,
      },
    },
  };

  const schemaExports = {
    listings: {
      id: 'id',
      tenantId: 'tenant_id',
      productId: 'product_id',
      sku: 'sku',
      price: 'price',
      status: 'status',
      inventoryQuantity: 'inventory_quantity',
    },
  };

  return {
    db,
    schema: schemaExports,
    eq: vi.fn().mockReturnValue(true),
    and: vi.fn().mockReturnValue(true),
    or: vi.fn().mockReturnValue(true),
    sql: vi.fn().mockReturnValue(true),
  };
});

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SESSION_ID = 'test-session-123';
const LISTING_ID = '11111111-1111-1111-1111-111111111111';

describe('Cart Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetCartStore();

    app = Fastify({ logger: false });
    errorHandlerPlugin(app);

    // Register cart routes directly (isolated from other routes)
    const { cartRoutes } = await import('./cart.js');
    await app.register(cartRoutes, { prefix: '/api/v1/storefront/cart' });
    await app.ready();
  });

  afterEach(async () => {
    stopReservationCleanup();
    resetCartStore();
    await app.close();
  });

  describe('POST /api/v1/storefront/cart/add', () => {
    it('should add an item to the cart', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 2,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.sessionId).toBe(SESSION_ID);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].listingId).toBe(LISTING_ID);
      expect(body.data.items[0].quantity).toBe(2);
      expect(body.data.itemCount).toBe(1);
    });

    it('should return 400 when x-session-id header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MISSING_SESSION');
    });

    it('should return 401 when x-tenant-id header is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 400 when listingId is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: 'not-a-uuid',
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when quantity is 0', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when quantity exceeds 100', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 101,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when listing does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.listings.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: '99999999-9999-9999-9999-999999999999',
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('LISTING_NOT_FOUND');
    });

    it('should return 409 when insufficient stock', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.listings.findFirst as any).mockResolvedValueOnce({
        id: LISTING_ID,
        tenantId: TENANT_ID,
        inventoryQuantity: 2,
        status: 'active',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 5,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INSUFFICIENT_STOCK');
    });

    it('should accumulate quantity on repeated add', async () => {
      // First add
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 3,
        },
      });

      // Second add
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 2,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items[0].quantity).toBe(5);
    });
  });

  describe('GET /api/v1/storefront/cart', () => {
    it('should return empty cart for new session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/cart',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(0);
      expect(body.data.itemCount).toBe(0);
      expect(body.data.subtotal).toBe('0.00');
    });

    it('should return cart contents with listing details and subtotal', async () => {
      // Add an item first
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 2,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/cart',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].listingId).toBe(LISTING_ID);
      expect(body.data.items[0].quantity).toBe(2);
      expect(body.data.items[0].sku).toBe('SKU-001');
      expect(body.data.items[0].price).toBe('29.99');
      expect(body.data.items[0].listing).toBeDefined();
      expect(body.data.items[0].listing.sku).toBe('SKU-001');
      expect(body.data.items[0].listing.price).toBe('29.99');
      expect(body.data.subtotal).toBe('59.98');
    });

    it('should return 400 when session ID is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/storefront/cart',
        headers: {
          'x-tenant-id': TENANT_ID,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MISSING_SESSION');
    });
  });

  describe('PUT /api/v1/storefront/cart/items/:listingId', () => {
    it('should update item quantity', async () => {
      // Add an item first
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 2,
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/storefront/cart/items/${LISTING_ID}`,
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          quantity: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items[0].quantity).toBe(5);
    });

    it('should return 404 when item not in cart', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/storefront/cart/items/${LISTING_ID}`,
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          quantity: 3,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ITEM_NOT_FOUND');
    });

    it('should return 409 when insufficient stock for new quantity', async () => {
      // Add item with mock inventory of 50
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 2,
        },
      });

      // Mock listing with only 5 available for the update request
      const { db } = await import('@ecommerce/database');
      (db.query.listings.findFirst as any).mockResolvedValueOnce({
        id: LISTING_ID,
        tenantId: TENANT_ID,
        inventoryQuantity: 5,
        status: 'active',
        sku: 'SKU-001',
        price: '29.99',
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/storefront/cart/items/${LISTING_ID}`,
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          quantity: 10,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INSUFFICIENT_STOCK');
    });

    it('should return 400 when quantity exceeds 100', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/storefront/cart/items/${LISTING_ID}`,
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          quantity: 101,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/storefront/cart/items/:listingId', () => {
    it('should remove item from cart', async () => {
      // Add an item first
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 2,
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/storefront/cart/items/${LISTING_ID}`,
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(0);
      expect(body.data.itemCount).toBe(0);
    });

    it('should return 404 when item not in cart', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/storefront/cart/items/${LISTING_ID}`,
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ITEM_NOT_FOUND');
    });

    it('should return 400 when listingId is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/storefront/cart/items/not-a-uuid',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/storefront/cart', () => {
    it('should clear all items from cart', async () => {
      // Add items first
      await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/add',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
        payload: {
          listingId: LISTING_ID,
          quantity: 2,
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/storefront/cart',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(0);
      expect(body.data.itemCount).toBe(0);
    });

    it('should succeed even if cart is empty', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/storefront/cart',
        headers: {
          'x-tenant-id': TENANT_ID,
          'x-session-id': SESSION_ID,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(0);
    });
  });
});
