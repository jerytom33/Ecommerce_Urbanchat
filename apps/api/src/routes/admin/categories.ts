import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and } from '@ecommerce/database';
import { validateBody, validateQuery, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(128, 'Name must be 128 characters or less'),
  parentId: z.string().uuid('Invalid parent ID format').nullable().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(128, 'Name must be 128 characters or less'),
});

const categoryIdParamSchema = z.object({
  id: z.string().uuid('Invalid category ID format'),
});

const listCategoriesQuerySchema = z.object({
  format: z.enum(['tree', 'flat']).optional().default('flat'),
});

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

interface CategoryRow {
  id: string;
  tenantId: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  depth: number;
  createdAt: Date;
  updatedAt: Date;
  children: CategoryTreeNode[];
}

/**
 * Builds a tree structure from a flat list of categories.
 */
function buildTree(categories: CategoryRow[]): CategoryTreeNode[] {
  const nodeMap = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of categories) {
    nodeMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      parentId: cat.parentId,
      path: cat.path,
      depth: cat.depth,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      children: [],
    });
  }

  for (const cat of categories) {
    const node = nodeMap.get(cat.id)!;
    if (cat.parentId && nodeMap.has(cat.parentId)) {
      nodeMap.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Category management routes registered under /api/v1/admin/categories
 */
export async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/admin/categories
   * Creates a new category with optional parent and depth enforcement.
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = validateBody(createCategorySchema, request);

    let depth = 0;
    let parentPath = '';

    if (body.parentId) {
      // Validate parent exists and belongs to the same tenant
      const [parent] = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.id, body.parentId),
            eq(schema.categories.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!parent) {
        throw new AppError(404, 'PARENT_NOT_FOUND', 'Parent category not found');
      }

      // Enforce max depth: parent must be at depth < 4 to allow a child
      if (parent.depth >= 4) {
        throw new AppError(400, 'MAX_DEPTH_EXCEEDED', 'Maximum category depth of 5 levels exceeded');
      }

      depth = parent.depth + 1;
      parentPath = parent.path;
    }

    // Insert category - we need the generated ID to build the path
    const [category] = await db
      .insert(schema.categories)
      .values({
        tenantId,
        name: body.name,
        parentId: body.parentId ?? null,
        path: 'placeholder', // Will update after getting ID
        depth,
      })
      .returning();

    // Build the LTREE path
    const path = parentPath ? `${parentPath}.${category.id}` : category.id;

    // Update the path with the actual value
    const [updated] = await db
      .update(schema.categories)
      .set({ path })
      .where(eq(schema.categories.id, category.id))
      .returning();

    return reply.status(201).send({
      category: {
        id: updated.id,
        name: updated.name,
        parentId: updated.parentId,
        path: updated.path,
        depth: updated.depth,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  });

  /**
   * GET /api/v1/admin/categories
   * Lists all categories for the tenant with optional tree format.
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(listCategoriesQuerySchema, request);

    const categories = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.tenantId, tenantId))
      .orderBy(schema.categories.path);

    if (query.format === 'tree') {
      return reply.status(200).send({
        categories: buildTree(categories as CategoryRow[]),
        format: 'tree',
      });
    }

    return reply.status(200).send({
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        parentId: cat.parentId,
        path: cat.path,
        depth: cat.depth,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      })),
      format: 'flat',
    });
  });

  /**
   * GET /api/v1/admin/categories/:id
   * Gets a single category with its children.
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(categoryIdParamSchema, request);

    const [category] = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!category) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }

    // Find direct children
    const children = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.parentId, id),
          eq(schema.categories.tenantId, tenantId),
        ),
      )
      .orderBy(schema.categories.name);

    return reply.status(200).send({
      category: {
        id: category.id,
        name: category.name,
        parentId: category.parentId,
        path: category.path,
        depth: category.depth,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
      children: children.map((child) => ({
        id: child.id,
        name: child.name,
        parentId: child.parentId,
        path: child.path,
        depth: child.depth,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt,
      })),
    });
  });

  /**
   * PUT /api/v1/admin/categories/:id
   * Updates the category name (moving parent is not supported in prototype).
   */
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(categoryIdParamSchema, request);
    const body = validateBody(updateCategorySchema, request);

    // Verify category exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }

    const [updated] = await db
      .update(schema.categories)
      .set({
        name: body.name,
        updatedAt: new Date(),
      })
      .where(eq(schema.categories.id, id))
      .returning();

    return reply.status(200).send({
      category: {
        id: updated.id,
        name: updated.name,
        parentId: updated.parentId,
        path: updated.path,
        depth: updated.depth,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  });

  /**
   * DELETE /api/v1/admin/categories/:id
   * Deletes a category only if it has no products assigned and no child categories.
   */
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(categoryIdParamSchema, request);

    // Verify category exists and belongs to tenant
    const [existing] = await db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          eq(schema.categories.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }

    // Check for child categories
    const children = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.parentId, id),
          eq(schema.categories.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (children.length > 0) {
      throw new AppError(409, 'CATEGORY_HAS_CHILDREN', 'Cannot delete category with child categories');
    }

    // Check for products assigned to this category
    const products = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.categoryId, id),
          eq(schema.products.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (products.length > 0) {
      throw new AppError(409, 'CATEGORY_HAS_PRODUCTS', 'Cannot delete category with assigned products');
    }

    await db
      .delete(schema.categories)
      .where(eq(schema.categories.id, id));

    return reply.status(204).send();
  });
}
