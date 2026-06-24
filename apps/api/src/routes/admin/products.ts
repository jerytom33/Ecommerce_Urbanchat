import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, ilike, lt, sql } from '@ecommerce/database';
import { validateBody, validateQuery, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createProductSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be at most 255 characters'),
  description: z
    .string()
    .max(10000, 'Description must be at most 10,000 characters')
    .optional()
    .nullable(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  categoryId: z.string().uuid('categoryId must be a valid UUID').optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const updateProductSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be at most 255 characters').optional(),
  description: z
    .string()
    .max(10000, 'Description must be at most 10,000 characters')
    .optional()
    .nullable(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  categoryId: z.string().uuid('categoryId must be a valid UUID').optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const listProductsQuerySchema = z.object({
  cursor: z.string().uuid('cursor must be a valid UUID').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  search: z.string().max(255).optional(),
});

const productIdParamSchema = z.object({
  id: z.string().uuid('Product ID must be a valid UUID'),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Extracts tenant ID from JWT claims or falls back to x-tenant-id header.
 * Throws AppError if no tenant context is available.
 */
function getTenantId(request: FastifyRequest): string {
  // JWT claims would be set by auth middleware (future)
  const jwtTenantId = (request as any).tenantId;
  if (jwtTenantId) return jwtTenantId;

  // Fallback for prototype: use x-tenant-id header
  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;

  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header or authenticate.');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function productRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /products — Create a new product
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = validateBody(createProductSchema, request);

    const [product] = await db
      .insert(schema.products)
      .values({
        tenantId,
        title: body.title,
        description: body.description ?? undefined,
        status: body.status,
        categoryId: body.categoryId ?? undefined,
        metadata: body.metadata ?? undefined,
      })
      .returning();

    return reply.status(201).send({ data: product });
  });

  /**
   * GET /products — List products with cursor-based pagination
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(listProductsQuerySchema, request);

    const conditions = [eq(schema.products.tenantId, tenantId)];

    // Filter by status
    if (query.status) {
      conditions.push(eq(schema.products.status, query.status));
    }

    // Search by title (case-insensitive)
    if (query.search) {
      conditions.push(ilike(schema.products.title, `%${query.search}%`));
    }

    // Cursor-based pagination: fetch items created before the cursor's createdAt
    if (query.cursor) {
      const cursorProduct = await db.query.products.findFirst({
        where: and(eq(schema.products.id, query.cursor), eq(schema.products.tenantId, tenantId)),
      });
      if (cursorProduct) {
        conditions.push(lt(schema.products.createdAt, cursorProduct.createdAt));
      }
    }

    // Fetch one extra to determine if there are more results
    const limit = query.limit ?? 20;
    const products = await db.query.products.findMany({
      where: and(...conditions),
      orderBy: (products, { desc }) => [desc(products.createdAt)],
      limit: limit + 1,
    });

    const hasMore = products.length > limit;
    const data = hasMore ? products.slice(0, limit) : products;
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
   * GET /products/:id — Get a single product with its listings and media
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(productIdParamSchema, request);

    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, id), eq(schema.products.tenantId, tenantId)),
    });

    if (!product) {
      throw new AppError(404, 'NOT_FOUND', `Product with id '${id}' not found`);
    }

    // Fetch related listings
    const productListings = await db.query.listings.findMany({
      where: and(
        eq(schema.listings.productId, id),
        eq(schema.listings.tenantId, tenantId),
      ),
    });

    // Fetch related media
    const productMedia = await db.query.media.findMany({
      where: and(
        eq(schema.media.productId, id),
        eq(schema.media.tenantId, tenantId),
      ),
      orderBy: (media, { asc }) => [asc(media.sortOrder)],
    });

    return reply.send({
      data: {
        ...product,
        listings: productListings,
        media: productMedia,
      },
    });
  });

  /**
   * PUT /products/:id — Partial update of a product
   */
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(productIdParamSchema, request);
    const body = validateBody(updateProductSchema, request);

    // Verify product exists and belongs to tenant
    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.id, id), eq(schema.products.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Product with id '${id}' not found`);
    }

    // Build update fields (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const [updated] = await db
      .update(schema.products)
      .set(updateData)
      .where(and(eq(schema.products.id, id), eq(schema.products.tenantId, tenantId)))
      .returning();

    return reply.send({ data: updated });
  });

  /**
   * DELETE /products/:id — Soft delete (set status to 'archived')
   */
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(productIdParamSchema, request);

    // Verify product exists and belongs to tenant
    const existing = await db.query.products.findFirst({
      where: and(eq(schema.products.id, id), eq(schema.products.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Product with id '${id}' not found`);
    }

    const [archived] = await db
      .update(schema.products)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(eq(schema.products.id, id), eq(schema.products.tenantId, tenantId)))
      .returning();

    return reply.send({ data: archived });
  });
}
