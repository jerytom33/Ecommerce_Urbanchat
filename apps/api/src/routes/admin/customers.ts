import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, ilike, or, sql } from '@ecommerce/database';
import { validateBody, validateQuery, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createCustomerSchema = z.object({
  email: z.string().email('A valid email is required').max(255, 'Email must be at most 255 characters'),
  firstName: z.string().max(100, 'First name must be at most 100 characters').optional().nullable(),
  lastName: z.string().max(100, 'Last name must be at most 100 characters').optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

const updateCustomerSchema = z.object({
  email: z.string().email('A valid email is required').max(255, 'Email must be at most 255 characters').optional(),
  firstName: z.string().max(100, 'First name must be at most 100 characters').optional().nullable(),
  lastName: z.string().max(100, 'Last name must be at most 100 characters').optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  search: z.string().max(255).optional(),
});

const customerIdParamSchema = z.object({
  id: z.string().uuid('Customer ID must be a valid UUID'),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Extracts tenant ID from JWT claims or falls back to x-tenant-id header.
 * Throws AppError if no tenant context is available.
 */
function getTenantId(request: FastifyRequest): string {
  const jwtTenantId = (request as any).tenantId;
  if (jwtTenantId) return jwtTenantId;

  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;

  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header or authenticate.');
}

// ─── Service Function ────────────────────────────────────────────────────────

/**
 * Finds or creates a customer by email within a tenant, then updates
 * their profile metrics after an order is placed.
 *
 * Called by the checkout flow when an order is placed.
 */
export async function upsertCustomerFromOrder(
  tenantId: string,
  email: string,
  orderTotal: number
): Promise<{
  id: string;
  email: string;
  totalOrders: number;
  totalSpend: string;
  averageOrderValue: string;
  lastPurchaseDate: Date;
}> {
  // Find existing customer by email within tenant
  const existing = await db.query.customers.findFirst({
    where: and(
      eq(schema.customers.tenantId, tenantId),
      eq(schema.customers.email, email.toLowerCase()),
    ),
  });

  const now = new Date();

  if (existing) {
    // Update existing customer metrics
    const newTotalOrders = existing.totalOrders + 1;
    const currentTotalSpend = parseFloat(existing.totalSpend as string) || 0;
    const newTotalSpend = currentTotalSpend + orderTotal;
    const newAverageOrderValue = newTotalSpend / newTotalOrders;

    const [updated] = await db
      .update(schema.customers)
      .set({
        totalOrders: newTotalOrders,
        totalSpend: newTotalSpend.toFixed(2),
        averageOrderValue: newAverageOrderValue.toFixed(2),
        lastPurchaseDate: now,
        updatedAt: now,
      })
      .where(and(
        eq(schema.customers.id, existing.id),
        eq(schema.customers.tenantId, tenantId),
      ))
      .returning();

    return {
      id: updated.id,
      email: updated.email,
      totalOrders: updated.totalOrders,
      totalSpend: updated.totalSpend as string,
      averageOrderValue: updated.averageOrderValue as string,
      lastPurchaseDate: updated.lastPurchaseDate!,
    };
  } else {
    // Create new customer profile
    const averageOrderValue = orderTotal;

    const [created] = await db
      .insert(schema.customers)
      .values({
        tenantId,
        email: email.toLowerCase(),
        totalOrders: 1,
        totalSpend: orderTotal.toFixed(2),
        averageOrderValue: averageOrderValue.toFixed(2),
        lastPurchaseDate: now,
        tags: [],
      })
      .returning();

    return {
      id: created.id,
      email: created.email,
      totalOrders: created.totalOrders,
      totalSpend: created.totalSpend as string,
      averageOrderValue: created.averageOrderValue as string,
      lastPurchaseDate: created.lastPurchaseDate!,
    };
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function customerRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /customers — List customers with pagination (50 per page), search by name/email
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(listCustomersQuerySchema, request);

    const conditions = [eq(schema.customers.tenantId, tenantId)];

    // Search by name or email (case-insensitive)
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(schema.customers.email, searchPattern),
          ilike(schema.customers.firstName, searchPattern),
          ilike(schema.customers.lastName, searchPattern),
        )!,
      );
    }

    const limit = query.limit ?? 50;
    const offset = (query.page - 1) * limit;

    const customers = await db.query.customers.findMany({
      where: and(...conditions),
      orderBy: (customers, { desc }) => [desc(customers.createdAt)],
      limit: limit + 1,
      offset,
    });

    const hasMore = customers.length > limit;
    const data = hasMore ? customers.slice(0, limit) : customers;

    return reply.send({
      data,
      pagination: {
        page: query.page,
        limit,
        hasMore,
      },
    });
  });

  /**
   * GET /customers/:id — Get customer profile with engagement metrics
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(customerIdParamSchema, request);

    const customer = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, id), eq(schema.customers.tenantId, tenantId)),
    });

    if (!customer) {
      throw new AppError(404, 'NOT_FOUND', `Customer with id '${id}' not found`);
    }

    // Calculate days since last purchase
    const daysSinceLastPurchase = customer.lastPurchaseDate
      ? Math.floor((Date.now() - new Date(customer.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return reply.send({
      data: {
        ...customer,
        engagementMetrics: {
          totalOrders: customer.totalOrders,
          totalSpend: customer.totalSpend,
          averageOrderValue: customer.averageOrderValue,
          daysSinceLastPurchase,
        },
      },
    });
  });

  /**
   * POST /customers — Manually create a customer
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = validateBody(createCustomerSchema, request);

    // Check for duplicate email within tenant
    const existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(schema.customers.tenantId, tenantId),
        eq(schema.customers.email, body.email.toLowerCase()),
      ),
    });

    if (existingCustomer) {
      throw new AppError(409, 'CONFLICT', `A customer with email '${body.email}' already exists`);
    }

    const [customer] = await db
      .insert(schema.customers)
      .values({
        tenantId,
        email: body.email.toLowerCase(),
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        tags: body.tags ?? [],
        totalOrders: 0,
        totalSpend: '0',
        averageOrderValue: '0',
      })
      .returning();

    return reply.status(201).send({ data: customer });
  });

  /**
   * PUT /customers/:id — Update customer info/tags
   */
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(customerIdParamSchema, request);
    const body = validateBody(updateCustomerSchema, request);

    // Verify customer exists and belongs to tenant
    const existing = await db.query.customers.findFirst({
      where: and(eq(schema.customers.id, id), eq(schema.customers.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Customer with id '${id}' not found`);
    }

    // If email is being changed, check for conflicts
    if (body.email && body.email.toLowerCase() !== existing.email.toLowerCase()) {
      const emailConflict = await db.query.customers.findFirst({
        where: and(
          eq(schema.customers.tenantId, tenantId),
          eq(schema.customers.email, body.email.toLowerCase()),
        ),
      });

      if (emailConflict) {
        throw new AppError(409, 'CONFLICT', `A customer with email '${body.email}' already exists`);
      }
    }

    // Build update fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.email !== undefined) updateData.email = body.email.toLowerCase();
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.tags !== undefined) updateData.tags = body.tags;

    const [updated] = await db
      .update(schema.customers)
      .set(updateData)
      .where(and(eq(schema.customers.id, id), eq(schema.customers.tenantId, tenantId)))
      .returning();

    return reply.send({ data: updated });
  });
}
