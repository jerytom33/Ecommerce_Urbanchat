import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, inArray } from '@ecommerce/database';
import { validateBody, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Constants ───────────────────────────────────────────────────────────────

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Allowed status transitions map.
 * Each key is a current status; the value is an array of valid next statuses.
 * Terminal states (returned, cancelled) have no allowed transitions.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  returned: [],
  cancelled: [],
};

/**
 * Validates whether a status transition is allowed.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const orderIdParamSchema = z.object({
  id: z.string().uuid('Order ID must be a valid UUID'),
});

const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` }),
  }),
});

const fulfillLineItemsSchema = z.object({
  lineItemIds: z.array(z.string().uuid('Each line item ID must be a valid UUID')).min(1, 'At least one line item ID is required'),
  carrierName: z.string().min(1, 'Carrier name is required').max(100),
  trackingNumber: z.string().min(1, 'Tracking number is required').max(255),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function getTenantId(request: FastifyRequest): string {
  const jwtTenantId = (request as any).tenantId;
  if (jwtTenantId) return jwtTenantId;

  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;

  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header or authenticate.');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function fulfillmentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * PUT /orders/:id/status — Update order status with transition validation
   */
  fastify.put('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(orderIdParamSchema, request);
    const { status: newStatus } = validateBody(updateStatusSchema, request);

    // Fetch existing order
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.tenantId, tenantId)),
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', `Order with id '${id}' not found`);
    }

    const currentStatus = order.status as OrderStatus;

    // Validate transition
    if (!isValidTransition(currentStatus, newStatus)) {
      throw new AppError(
        400,
        'INVALID_TRANSITION',
        `Cannot transition order from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${ALLOWED_TRANSITIONS[currentStatus].join(', ') || 'none (terminal state)'}`,
      );
    }

    // Update order status
    const [updated] = await db
      .update(schema.orders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(and(eq(schema.orders.id, id), eq(schema.orders.tenantId, tenantId)))
      .returning();

    return reply.send({ data: updated });
  });

  /**
   * PUT /orders/:id/fulfill — Mark line items as fulfilled (partial fulfillment supported)
   */
  fastify.put('/:id/fulfill', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(orderIdParamSchema, request);
    const { lineItemIds, carrierName, trackingNumber } = validateBody(fulfillLineItemsSchema, request);

    // Verify order exists and belongs to tenant
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.tenantId, tenantId)),
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', `Order with id '${id}' not found`);
    }

    // Fetch specified line items
    const lineItems = await db.query.orderLineItems.findMany({
      where: and(
        eq(schema.orderLineItems.orderId, id),
        eq(schema.orderLineItems.tenantId, tenantId),
        inArray(schema.orderLineItems.id, lineItemIds),
      ),
    });

    if (lineItems.length !== lineItemIds.length) {
      const foundIds = lineItems.map((item) => item.id);
      const missingIds = lineItemIds.filter((lid) => !foundIds.includes(lid));
      throw new AppError(400, 'INVALID_LINE_ITEMS', `Line items not found: ${missingIds.join(', ')}`);
    }

    // Update fulfillment status, carrier, and tracking for specified line items
    await db
      .update(schema.orderLineItems)
      .set({
        fulfillmentStatus: 'shipped',
        carrierName,
        trackingNumber,
      })
      .where(
        and(
          eq(schema.orderLineItems.orderId, id),
          eq(schema.orderLineItems.tenantId, tenantId),
          inArray(schema.orderLineItems.id, lineItemIds),
        ),
      );

    // Check if all line items for this order are now shipped
    const allLineItems = await db.query.orderLineItems.findMany({
      where: and(
        eq(schema.orderLineItems.orderId, id),
        eq(schema.orderLineItems.tenantId, tenantId),
      ),
    });

    const allShipped = allLineItems.every((item) => item.fulfillmentStatus === 'shipped');

    // Auto-update order status to 'shipped' if all items fulfilled
    if (allShipped) {
      const currentStatus = order.status as OrderStatus;
      if (isValidTransition(currentStatus, 'shipped')) {
        await db
          .update(schema.orders)
          .set({ status: 'shipped', updatedAt: new Date() })
          .where(and(eq(schema.orders.id, id), eq(schema.orders.tenantId, tenantId)));
      }
    }

    // Fetch updated line items to return
    const updatedItems = await db.query.orderLineItems.findMany({
      where: and(
        eq(schema.orderLineItems.orderId, id),
        eq(schema.orderLineItems.tenantId, tenantId),
        inArray(schema.orderLineItems.id, lineItemIds),
      ),
    });

    return reply.send({
      data: {
        fulfilledItems: updatedItems,
        allItemsShipped: allShipped,
      },
    });
  });

  /**
   * GET /orders/:id/fulfillments — Get fulfillment groups for an order
   */
  fastify.get('/:id/fulfillments', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(orderIdParamSchema, request);

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, id), eq(schema.orders.tenantId, tenantId)),
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', `Order with id '${id}' not found`);
    }

    // Fetch all line items for the order
    const lineItems = await db.query.orderLineItems.findMany({
      where: and(
        eq(schema.orderLineItems.orderId, id),
        eq(schema.orderLineItems.tenantId, tenantId),
      ),
    });

    // Group line items by carrier/tracking combination
    const fulfillmentGroups: Record<string, { carrierName: string; trackingNumber: string; items: typeof lineItems }> = {};
    const unfulfilled: typeof lineItems = [];

    for (const item of lineItems) {
      if (item.carrierName && item.trackingNumber) {
        const key = `${item.carrierName}::${item.trackingNumber}`;
        if (!fulfillmentGroups[key]) {
          fulfillmentGroups[key] = {
            carrierName: item.carrierName,
            trackingNumber: item.trackingNumber,
            items: [],
          };
        }
        fulfillmentGroups[key].items.push(item);
      } else {
        unfulfilled.push(item);
      }
    }

    return reply.send({
      data: {
        orderStatus: order.status,
        fulfillmentGroups: Object.values(fulfillmentGroups),
        unfulfilled,
      },
    });
  });
}
