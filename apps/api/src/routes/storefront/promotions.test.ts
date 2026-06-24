import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';
import { calculateDiscountAmount } from './promotions.js';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const now = new Date();
  const pastDate = new Date('2023-01-01T00:00:00Z');
  const futureDate = new Date('2030-12-31T23:59:59Z');

  const mockActivePromotion = {
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
    startsAt: pastDate,
    endsAt: futureDate,
    createdAt: pastDate,
    updatedAt: pastDate,
  };

  // Query mocks
  const mockFindFirst = vi.fn().mockResolvedValue(mockActivePromotion);
  const mockFindMany = vi.fn().mockResolvedValue([]);

  const mockInsertReturning = vi.fn().mockResolvedValue([mockActivePromotion]);
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockUpdateReturning = vi.fn().mockResolvedValue([mockActivePromotion]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      promotions: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
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

describe('Storefront Coupon Application Endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/storefront/cart/apply-coupon', () => {
    it('should apply a valid coupon code and return discount with calculated amount', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'SAVE10', cartTotal: 100 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.discount).toBeDefined();
      expect(body.discount.type).toBe('percentage');
      expect(body.discount.value).toBe(10);
      expect(body.discount.amount).toBe(10); // 10% of 100
      expect(body.discount.code).toBe('SAVE10');
      expect(body.discount.stackingRule).toBe('best_only');
      expect(body.message).toBe('Coupon applied successfully');
    });

    it('should apply coupon case-insensitively (lowercase input)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'save10', cartTotal: 100 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.discount).toBeDefined();
    });

    it('should apply coupon case-insensitively (mixed case input)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'SaVe10', cartTotal: 100 },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 when code is too short (less than 3 chars)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'AB' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when code exceeds 32 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'A'.repeat(33) },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when code contains special characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'SAVE-10!' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when code is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when coupon code is not found', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'NOTEXIST' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('COUPON_NOT_FOUND');
    });

    it('should return 400 when coupon is inactive', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: TENANT_ID,
        type: 'percentage',
        value: '10.00',
        code: 'INACTIVE',
        conditions: {},
        stackingRules: { mode: 'best_only' },
        maxRedemptions: null,
        currentRedemptions: 0,
        perCustomerLimit: null,
        active: false,
        startsAt: new Date('2023-01-01T00:00:00Z'),
        endsAt: new Date('2030-12-31T23:59:59Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'INACTIVE' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('COUPON_INACTIVE');
    });

    it('should return 400 when coupon has expired', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: TENANT_ID,
        type: 'percentage',
        value: '10.00',
        code: 'EXPIRED',
        conditions: {},
        stackingRules: { mode: 'best_only' },
        maxRedemptions: null,
        currentRedemptions: 0,
        perCustomerLimit: null,
        active: true,
        startsAt: new Date('2020-01-01T00:00:00Z'),
        endsAt: new Date('2020-12-31T23:59:59Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'EXPIRED' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('COUPON_EXPIRED');
    });

    it('should return 400 when coupon has not started yet', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: TENANT_ID,
        type: 'percentage',
        value: '10.00',
        code: 'FUTURE',
        conditions: {},
        stackingRules: { mode: 'best_only' },
        maxRedemptions: null,
        currentRedemptions: 0,
        perCustomerLimit: null,
        active: true,
        startsAt: new Date('2099-01-01T00:00:00Z'),
        endsAt: new Date('2099-12-31T23:59:59Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'FUTURE' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('COUPON_NOT_STARTED');
    });

    it('should return 400 when coupon has reached max redemptions', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: TENANT_ID,
        type: 'percentage',
        value: '10.00',
        code: 'MAXED',
        conditions: {},
        stackingRules: { mode: 'best_only' },
        maxRedemptions: 10,
        currentRedemptions: 10,
        perCustomerLimit: null,
        active: true,
        startsAt: new Date('2023-01-01T00:00:00Z'),
        endsAt: new Date('2030-12-31T23:59:59Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'MAXED' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('COUPON_MAX_REDEMPTIONS');
    });

    it('should return 400 when cart total is below minimum required', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'SAVE10', cartTotal: 30 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CART_MINIMUM_NOT_MET');
    });

    it('should return 400 when products are not eligible', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        tenantId: TENANT_ID,
        type: 'percentage',
        value: '10.00',
        code: 'PRODUCT10',
        conditions: { specificProducts: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] },
        stackingRules: { mode: 'best_only' },
        maxRedemptions: null,
        currentRedemptions: 0,
        perCustomerLimit: null,
        active: true,
        startsAt: new Date('2023-01-01T00:00:00Z'),
        endsAt: new Date('2030-12-31T23:59:59Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          code: 'PRODUCT10',
          cartTotal: 100,
          productIds: ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PRODUCTS_NOT_ELIGIBLE');
    });

    it('should apply fixed_amount discount and cap at cart total', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '22222222-2222-2222-2222-222222222222',
        tenantId: TENANT_ID,
        type: 'fixed_amount',
        value: '50.00',
        code: 'FLAT50',
        conditions: {},
        stackingRules: { mode: 'best_only' },
        maxRedemptions: null,
        currentRedemptions: 0,
        perCustomerLimit: null,
        active: true,
        startsAt: new Date('2023-01-01T00:00:00Z'),
        endsAt: new Date('2030-12-31T23:59:59Z'),
      });

      // Cart total $30 < discount $50 — should cap at $30
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'FLAT50', cartTotal: 30 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.discount.type).toBe('fixed_amount');
      expect(body.discount.value).toBe(50);
      expect(body.discount.amount).toBe(30); // Capped at cart total
    });

    it('should apply free_shipping discount with zero amount', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.promotions.findFirst as any).mockResolvedValueOnce({
        id: '33333333-3333-3333-3333-333333333333',
        tenantId: TENANT_ID,
        type: 'free_shipping',
        value: '0.00',
        code: 'FREESHIP',
        conditions: {},
        stackingRules: { mode: 'combinable' },
        maxRedemptions: null,
        currentRedemptions: 0,
        perCustomerLimit: null,
        active: true,
        startsAt: new Date('2023-01-01T00:00:00Z'),
        endsAt: new Date('2030-12-31T23:59:59Z'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { code: 'FREESHIP', cartTotal: 100 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.discount.type).toBe('free_shipping');
      expect(body.discount.amount).toBe(0);
      expect(body.discount.stackingRule).toBe('combinable');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/storefront/cart/apply-coupon',
        payload: { code: 'SAVE10' },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

describe('calculateDiscountAmount', () => {
  it('should calculate percentage discount correctly', () => {
    expect(calculateDiscountAmount('percentage', 10, 100)).toBe(10);
    expect(calculateDiscountAmount('percentage', 50, 200)).toBe(100);
    expect(calculateDiscountAmount('percentage', 100, 50)).toBe(50);
  });

  it('should calculate fixed_amount discount correctly', () => {
    expect(calculateDiscountAmount('fixed_amount', 10, 100)).toBe(10);
    expect(calculateDiscountAmount('fixed_amount', 5.50, 20)).toBe(5.50);
  });

  it('should cap discount at cart total (never negative final price)', () => {
    // Fixed amount > cart total
    expect(calculateDiscountAmount('fixed_amount', 50, 30)).toBe(30);
    // Percentage can't exceed cart total by design (100% of 50 = 50)
    expect(calculateDiscountAmount('percentage', 100, 50)).toBe(50);
  });

  it('should return 0 for free_shipping type', () => {
    expect(calculateDiscountAmount('free_shipping', 0, 100)).toBe(0);
    expect(calculateDiscountAmount('free_shipping', 10, 50)).toBe(0);
  });

  it('should handle buy_x_get_y type', () => {
    expect(calculateDiscountAmount('buy_x_get_y', 15, 100)).toBe(15);
    // Capped at cart total
    expect(calculateDiscountAmount('buy_x_get_y', 150, 100)).toBe(100);
  });

  it('should handle zero cart total', () => {
    expect(calculateDiscountAmount('percentage', 10, 0)).toBe(0);
    expect(calculateDiscountAmount('fixed_amount', 10, 0)).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    // 10% of 33.33 = 3.333 → 3.33
    expect(calculateDiscountAmount('percentage', 10, 33.33)).toBe(3.33);
    // 15% of 99.99 = 14.9985 → 15.00
    expect(calculateDiscountAmount('percentage', 15, 99.99)).toBe(15);
  });
});
