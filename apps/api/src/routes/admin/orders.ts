import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and } from '@ecommerce/database';
import { validateQuery, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.string().max(20).optional(),
});

const orderIdParamSchema = z.object({
  id: z.string().uuid('Order ID must be a valid UUID'),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// ─── Helper ──────────────────────────────────────────────────────────────────

function getTenantId(request: FastifyRequest): string {
  const jwtTenantId = (request as any).tenantId;
  if (jwtTenantId) return jwtTenantId;

  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;

  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header or authenticate.');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function orderRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /orders — List orders with pagination and optional status filter
   *
   * Query params: page, limit, status
   * Returns paginated list of orders for the tenant.
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(listOrdersQuerySchema, request);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(schema.orders.tenantId, tenantId)];
    if (query.status) {
      conditions.push(eq(schema.orders.status, query.status));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const orders = await db.query.orders.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    });

    return reply.send({
      data: orders.map((order) => ({
        id: order.id,
        status: order.status,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        discount: order.discount,
        total: order.total,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        hasMore: orders.length === limit,
      },
    });
  });

  /**
   * GET /orders/:id — Get a single order with its line items
   *
   * Returns the full order record with all line items.
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(orderIdParamSchema, request);

    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, id),
        eq(schema.orders.tenantId, tenantId),
      ),
    });

    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', `Order '${id}' not found`);
    }

    // Fetch line items
    const lineItems = await db.query.orderLineItems.findMany({
      where: and(
        eq(schema.orderLineItems.orderId, id),
        eq(schema.orderLineItems.tenantId, tenantId),
      ),
    });

    return reply.send({
      data: {
        id: order.id,
        customerId: order.customerId,
        status: order.status,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        discount: order.discount,
        total: order.total,
        currency: order.currency,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        lineItems: lineItems.map((li) => ({
          id: li.id,
          listingId: li.listingId,
          title: li.title,
          sku: li.sku,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          fulfillmentStatus: li.fulfillmentStatus,
          carrierName: li.carrierName,
          trackingNumber: li.trackingNumber,
          createdAt: li.createdAt.toISOString(),
        })),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  });
}
