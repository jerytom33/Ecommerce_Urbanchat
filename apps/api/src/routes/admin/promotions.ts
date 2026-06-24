import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, lt } from '@ecommerce/database';
import { validateBody, validateQuery, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const promotionTypeEnum = z.enum(['percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping']);

const stackingRuleSchema = z.object({
  mode: z.enum(['best_only', 'combinable']).default('best_only'),
}).default({ mode: 'best_only' });

const conditionsSchema = z.object({
  minCartValue: z.number().min(0).optional(),
  specificProducts: z.array(z.string().uuid()).optional(),
  specificCategories: z.array(z.string().uuid()).optional(),
  customerSegments: z.array(z.string()).optional(),
}).default({});

const createPromotionSchema = z.object({
  type: promotionTypeEnum,
  value: z.number().min(0).max(999999999.99),
  code: z.string()
    .min(3, 'Code must be at least 3 characters')
    .max(32, 'Code must be at most 32 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Code must be alphanumeric only')
    .optional()
    .nullable(),
  conditions: conditionsSchema,
  stackingRules: stackingRuleSchema,
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  perCustomerLimit: z.number().int().min(1).optional().nullable(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  active: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.type === 'percentage' && (data.value < 1 || data.value > 100)) {
      return false;
    }
    return true;
  },
  { message: 'Percentage discount value must be between 1 and 100', path: ['value'] },
).refine(
  (data) => {
    if (data.type === 'fixed_amount' && (data.value < 0.01 || data.value > 999999999.99)) {
      return false;
    }
    return true;
  },
  { message: 'Fixed amount discount value must be between 0.01 and 999,999,999.99', path: ['value'] },
);

const updatePromotionSchema = z.object({
  type: promotionTypeEnum.optional(),
  value: z.number().min(0).max(999999999.99).optional(),
  code: z.string()
    .min(3, 'Code must be at least 3 characters')
    .max(32, 'Code must be at most 32 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Code must be alphanumeric only')
    .optional()
    .nullable(),
  conditions: conditionsSchema.optional(),
  stackingRules: stackingRuleSchema.optional(),
  maxRedemptions: z.number().int().min(1).optional().nullable(),
  perCustomerLimit: z.number().int().min(1).optional().nullable(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
  active: z.boolean().optional(),
});

const listPromotionsQuerySchema = z.object({
  cursor: z.string().uuid('cursor must be a valid UUID').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: promotionTypeEnum.optional(),
  active: z.enum(['true', 'false']).optional(),
});

const promotionIdParamSchema = z.object({
  id: z.string().uuid('Promotion ID must be a valid UUID'),
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

export async function promotionRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /promotions — Create a new promotion/coupon
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = validateBody(createPromotionSchema, request);

    // If a code is provided, check uniqueness within this tenant (case-insensitive)
    if (body.code) {
      const existing = await db.query.promotions.findFirst({
        where: and(
          eq(schema.promotions.tenantId, tenantId),
          eq(schema.promotions.code, body.code.toUpperCase()),
        ),
      });
      if (existing) {
        throw new AppError(409, 'CONFLICT', `Promotion with code '${body.code}' already exists`);
      }
    }

    const [promotion] = await db
      .insert(schema.promotions)
      .values({
        tenantId,
        type: body.type,
        value: String(body.value),
        code: body.code ? body.code.toUpperCase() : null,
        conditions: body.conditions,
        stackingRules: body.stackingRules,
        maxRedemptions: body.maxRedemptions ?? null,
        perCustomerLimit: body.perCustomerLimit ?? null,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        active: body.active,
      })
      .returning();

    return reply.status(201).send({ data: promotion });
  });

  /**
   * GET /promotions — List promotions with cursor-based pagination
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(listPromotionsQuerySchema, request);

    const conditions = [eq(schema.promotions.tenantId, tenantId)];

    if (query.type) {
      conditions.push(eq(schema.promotions.type, query.type));
    }

    if (query.active !== undefined) {
      conditions.push(eq(schema.promotions.active, query.active === 'true'));
    }

    if (query.cursor) {
      const cursorPromotion = await db.query.promotions.findFirst({
        where: and(eq(schema.promotions.id, query.cursor), eq(schema.promotions.tenantId, tenantId)),
      });
      if (cursorPromotion) {
        conditions.push(lt(schema.promotions.createdAt, cursorPromotion.createdAt));
      }
    }

    const limit = query.limit ?? 20;
    const promotionsList = await db.query.promotions.findMany({
      where: and(...conditions),
      orderBy: (promotions, { desc }) => [desc(promotions.createdAt)],
      limit: limit + 1,
    });

    const hasMore = promotionsList.length > limit;
    const data = hasMore ? promotionsList.slice(0, limit) : promotionsList;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

    return reply.send({
      data,
      pagination: {
        cursor: nextCursor ?? null,
        hasMore,
      },
    });
  });

  /**
   * GET /promotions/:id — Get a single promotion with redemption stats
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(promotionIdParamSchema, request);

    const promotion = await db.query.promotions.findFirst({
      where: and(eq(schema.promotions.id, id), eq(schema.promotions.tenantId, tenantId)),
    });

    if (!promotion) {
      throw new AppError(404, 'NOT_FOUND', `Promotion with id '${id}' not found`);
    }

    // Build redemption stats
    const remainingRedemptions = promotion.maxRedemptions !== null
      ? promotion.maxRedemptions - promotion.currentRedemptions
      : null;

    return reply.send({
      data: {
        ...promotion,
        redemptionStats: {
          currentRedemptions: promotion.currentRedemptions,
          maxRedemptions: promotion.maxRedemptions,
          remainingRedemptions,
          perCustomerLimit: promotion.perCustomerLimit,
        },
      },
    });
  });

  /**
   * PUT /promotions/:id — Update a promotion
   */
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(promotionIdParamSchema, request);
    const body = validateBody(updatePromotionSchema, request);

    const existing = await db.query.promotions.findFirst({
      where: and(eq(schema.promotions.id, id), eq(schema.promotions.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Promotion with id '${id}' not found`);
    }

    // If code is being updated, check uniqueness
    if (body.code !== undefined && body.code !== null) {
      const codeConflict = await db.query.promotions.findFirst({
        where: and(
          eq(schema.promotions.tenantId, tenantId),
          eq(schema.promotions.code, body.code.toUpperCase()),
        ),
      });
      if (codeConflict && codeConflict.id !== id) {
        throw new AppError(409, 'CONFLICT', `Promotion with code '${body.code}' already exists`);
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.type !== undefined) updateData.type = body.type;
    if (body.value !== undefined) updateData.value = String(body.value);
    if (body.code !== undefined) updateData.code = body.code ? body.code.toUpperCase() : null;
    if (body.conditions !== undefined) updateData.conditions = body.conditions;
    if (body.stackingRules !== undefined) updateData.stackingRules = body.stackingRules;
    if (body.maxRedemptions !== undefined) updateData.maxRedemptions = body.maxRedemptions;
    if (body.perCustomerLimit !== undefined) updateData.perCustomerLimit = body.perCustomerLimit;
    if (body.startsAt !== undefined) updateData.startsAt = new Date(body.startsAt);
    if (body.endsAt !== undefined) updateData.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.active !== undefined) updateData.active = body.active;

    const [updated] = await db
      .update(schema.promotions)
      .set(updateData)
      .where(and(eq(schema.promotions.id, id), eq(schema.promotions.tenantId, tenantId)))
      .returning();

    return reply.send({ data: updated });
  });

  /**
   * DELETE /promotions/:id — Deactivate a promotion (soft delete, set active=false)
   */
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(promotionIdParamSchema, request);

    const existing = await db.query.promotions.findFirst({
      where: and(eq(schema.promotions.id, id), eq(schema.promotions.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Promotion with id '${id}' not found`);
    }

    // Soft delete: set active=false rather than removing the record
    await db
      .update(schema.promotions)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(schema.promotions.id, id), eq(schema.promotions.tenantId, tenantId)));

    return reply.status(204).send();
  });
}
