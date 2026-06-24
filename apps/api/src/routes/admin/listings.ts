import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, sql } from '@ecommerce/database';
import { validateBody, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createListingSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(64, 'SKU must be at most 64 characters'),
  price: z.coerce
    .number()
    .min(0.01, 'Price must be at least 0.01')
    .max(999999999.99, 'Price must be at most 999,999,999.99'),
  weight: z.coerce
    .number()
    .int('Weight must be an integer')
    .min(0, 'Weight must be at least 0')
    .max(1000000, 'Weight must be at most 1,000,000')
    .optional()
    .nullable(),
  inventoryQuantity: z.coerce
    .number()
    .int('Inventory quantity must be an integer')
    .min(0, 'Inventory quantity must be at least 0')
    .max(999999, 'Inventory quantity must be at most 999,999')
    .default(0),
  options: z.record(z.unknown()).optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const updateListingSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(64, 'SKU must be at most 64 characters').optional(),
  price: z.coerce
    .number()
    .min(0.01, 'Price must be at least 0.01')
    .max(999999999.99, 'Price must be at most 999,999,999.99')
    .optional(),
  weight: z.coerce
    .number()
    .int('Weight must be an integer')
    .min(0, 'Weight must be at least 0')
    .max(1000000, 'Weight must be at most 1,000,000')
    .optional()
    .nullable(),
  inventoryQuantity: z.coerce
    .number()
    .int('Inventory quantity must be an integer')
    .min(0, 'Inventory quantity must be at least 0')
    .max(999999, 'Inventory quantity must be at most 999,999')
    .optional(),
  options: z.record(z.unknown()).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

const productIdParamSchema = z.object({
  productId: z.string().uuid('Product ID must be a valid UUID'),
});

const listingIdParamSchema = z.object({
  id: z.string().uuid('Listing ID must be a valid UUID'),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Extracts tenant ID from JWT claims or falls back to x-tenant-id header.
 */
function getTenantId(request: FastifyRequest): string {
  const jwtTenantId = (request as any).tenantId;
  if (jwtTenantId) return jwtTenantId;

  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;

  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header or authenticate.');
}

/**
 * Checks if a database error is a unique constraint violation on tenant_id + sku.
 */
function isDuplicateSkuError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    // PostgreSQL unique_violation error code
    return (error as any).code === '23505' &&
      ((error as any).constraint_name === 'listings_tenant_id_sku_unique' ||
       (error as any).detail?.includes('sku'));
  }
  return false;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * Listing routes nested under products: POST /products/:productId/listings, GET /products/:productId/listings
 */
export async function listingProductRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /products/:productId/listings — Create a new listing for a product
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { productId } = validateParams(productIdParamSchema, request);
    const body = validateBody(createListingSchema, request);

    // Verify product exists and belongs to tenant
    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.tenantId, tenantId)),
    });

    if (!product) {
      throw new AppError(404, 'NOT_FOUND', `Product with id '${productId}' not found`);
    }

    // Count existing listings for this product (max 100)
    const existingListings = await db.query.listings.findMany({
      where: and(
        eq(schema.listings.productId, productId),
        eq(schema.listings.tenantId, tenantId),
      ),
    });

    if (existingListings.length >= 100) {
      throw new AppError(400, 'MAX_LISTINGS_EXCEEDED', 'A product cannot have more than 100 listings');
    }

    // Attempt to insert the listing
    try {
      const [listing] = await db
        .insert(schema.listings)
        .values({
          tenantId,
          productId,
          sku: body.sku,
          price: body.price.toFixed(2),
          weight: body.weight ?? undefined,
          inventoryQuantity: body.inventoryQuantity,
          options: body.options ?? undefined,
          status: body.status,
        })
        .returning();

      return reply.status(201).send({ data: listing });
    } catch (error: unknown) {
      if (isDuplicateSkuError(error)) {
        throw new AppError(409, 'DUPLICATE_SKU', `A listing with SKU '${body.sku}' already exists for this tenant`);
      }
      throw error;
    }
  });

  /**
   * GET /products/:productId/listings — List all listings for a product
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { productId } = validateParams(productIdParamSchema, request);

    // Verify product exists and belongs to tenant
    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.tenantId, tenantId)),
    });

    if (!product) {
      throw new AppError(404, 'NOT_FOUND', `Product with id '${productId}' not found`);
    }

    const listings = await db.query.listings.findMany({
      where: and(
        eq(schema.listings.productId, productId),
        eq(schema.listings.tenantId, tenantId),
      ),
    });

    return reply.send({ data: listings });
  });
}

/**
 * Listing routes for direct listing operations: PUT /listings/:id, DELETE /listings/:id
 */
export async function listingRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * PUT /listings/:id — Update a listing
   */
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(listingIdParamSchema, request);
    const body = validateBody(updateListingSchema, request);

    // Verify listing exists and belongs to tenant
    const existing = await db.query.listings.findFirst({
      where: and(eq(schema.listings.id, id), eq(schema.listings.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Listing with id '${id}' not found`);
    }

    // Build update fields (only include provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.sku !== undefined) updateData.sku = body.sku;
    if (body.price !== undefined) updateData.price = body.price.toFixed(2);
    if (body.weight !== undefined) updateData.weight = body.weight;
    if (body.inventoryQuantity !== undefined) updateData.inventoryQuantity = body.inventoryQuantity;
    if (body.options !== undefined) updateData.options = body.options;
    if (body.status !== undefined) updateData.status = body.status;

    try {
      const [updated] = await db
        .update(schema.listings)
        .set(updateData)
        .where(and(eq(schema.listings.id, id), eq(schema.listings.tenantId, tenantId)))
        .returning();

      return reply.send({ data: updated });
    } catch (error: unknown) {
      if (isDuplicateSkuError(error)) {
        throw new AppError(409, 'DUPLICATE_SKU', `A listing with SKU '${body.sku}' already exists for this tenant`);
      }
      throw error;
    }
  });

  /**
   * DELETE /listings/:id — Hard delete a listing
   */
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(listingIdParamSchema, request);

    // Verify listing exists and belongs to tenant
    const existing = await db.query.listings.findFirst({
      where: and(eq(schema.listings.id, id), eq(schema.listings.tenantId, tenantId)),
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', `Listing with id '${id}' not found`);
    }

    await db
      .delete(schema.listings)
      .where(and(eq(schema.listings.id, id), eq(schema.listings.tenantId, tenantId)));

    return reply.status(204).send();
  });
}
