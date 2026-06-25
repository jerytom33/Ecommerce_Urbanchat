import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../server.js';
import {
  isValidTransition,
  ALLOWED_TRANSITIONS,
  ORDER_STATUSES,
  OrderStatus,
} from './fulfillment.js';

// ─── Unit Tests for Transition Logic ─────────────────────────────────────────

describe('Fulfillment Status Transitions', () => {
  describe('isValidTransition', () => {
    it('allows pending → processing', () => {
      expect(isValidTransition('pending', 'processing')).toBe(true);
    });

    it('allows pending → cancelled', () => {
      expect(isValidTransition('pending', 'cancelled')).toBe(true);
    });

    it('disallows pending → shipped', () => {
      expect(isValidTransition('pending', 'shipped')).toBe(false);
    });

    it('disallows pending → delivered', () => {
      expect(isValidTransition('pending', 'delivered')).toBe(false);
    });

    it('allows processing → shipped', () => {
      expect(isValidTransition('processing', 'shipped')).toBe(true);
    });

    it('allows processing → cancelled', () => {
      expect(isValidTransition('processing', 'cancelled')).toBe(true);
    });

    it('disallows processing → pending', () => {
      expect(isValidTransition('processing', 'pending')).toBe(false);
    });

    it('allows shipped → delivered', () => {
      expect(isValidTransition('shipped', 'delivered')).toBe(true);
    });

    it('allows shipped → returned', () => {
      expect(isValidTransition('shipped', 'returned')).toBe(true);
    });

    it('disallows shipped → cancelled', () => {
      expect(isValidTransition('shipped', 'cancelled')).toBe(false);
    });

    it('allows delivered → returned', () => {
      expect(isValidTransition('delivered', 'returned')).toBe(true);
    });

    it('disallows delivered → shipped', () => {
      expect(isValidTransition('delivered', 'shipped')).toBe(false);
    });

    it('disallows any transition from returned (terminal)', () => {
      for (const status of ORDER_STATUSES) {
        expect(isValidTransition('returned', status)).toBe(false);
      }
    });

    it('disallows any transition from cancelled (terminal)', () => {
      for (const status of ORDER_STATUSES) {
        expect(isValidTransition('cancelled', status)).toBe(false);
      }
    });
  });

  describe('ALLOWED_TRANSITIONS completeness', () => {
    it('defines transitions for all statuses', () => {
      for (const status of ORDER_STATUSES) {
        expect(ALLOWED_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true);
      }
    });

    it('all transition targets are valid statuses', () => {
      for (const status of ORDER_STATUSES) {
        for (const target of ALLOWED_TRANSITIONS[status]) {
          expect(ORDER_STATUSES).toContain(target);
        }
      }
    });
  });
});

// ─── Integration Tests for Fulfillment Routes ────────────────────────────────

describe('Fulfillment Routes (Integration)', () => {
  let server: FastifyInstance;
  const testTenantId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    server = await buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('PUT /api/v1/admin/orders/:id/status', () => {
    it('returns 401 without tenant context', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/admin/orders/00000000-0000-0000-0000-000000000001/status',
        payload: { status: 'processing' },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 for invalid status value', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/admin/orders/00000000-0000-0000-0000-000000000001/status',
        headers: { 'x-tenant-id': testTenantId },
        payload: { status: 'invalid_status' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid UUID in order id', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/admin/orders/not-a-uuid/status',
        headers: { 'x-tenant-id': testTenantId },
        payload: { status: 'processing' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/v1/admin/orders/:id/fulfill', () => {
    it('returns 401 without tenant context', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/admin/orders/00000000-0000-0000-0000-000000000001/fulfill',
        payload: {
          lineItemIds: ['00000000-0000-0000-0000-000000000001'],
          carrierName: 'UPS',
          trackingNumber: '1Z999AA10123456784',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 400 for empty lineItemIds', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/admin/orders/00000000-0000-0000-0000-000000000001/fulfill',
        headers: { 'x-tenant-id': testTenantId },
        payload: {
          lineItemIds: [],
          carrierName: 'UPS',
          trackingNumber: '1Z999AA10123456784',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing carrierName', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/admin/orders/00000000-0000-0000-0000-000000000001/fulfill',
        headers: { 'x-tenant-id': testTenantId },
        payload: {
          lineItemIds: ['00000000-0000-0000-0000-000000000001'],
          trackingNumber: '1Z999AA10123456784',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing trackingNumber', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/v1/admin/orders/00000000-0000-0000-0000-000000000001/fulfill',
        headers: { 'x-tenant-id': testTenantId },
        payload: {
          lineItemIds: ['00000000-0000-0000-0000-000000000001'],
          carrierName: 'UPS',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/admin/orders/:id/fulfillments', () => {
    it('returns 401 without tenant context', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/00000000-0000-0000-0000-000000000001/fulfillments',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 400 for invalid UUID', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/admin/orders/not-a-uuid/fulfillments',
        headers: { 'x-tenant-id': testTenantId },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
