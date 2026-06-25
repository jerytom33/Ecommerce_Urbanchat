import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, or, ilike, sql } from '@ecommerce/database';
import { validateQuery } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').refine(
    (val) => val.trim().length > 0,
    { message: 'Search query cannot be empty or whitespace only' }
  ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const suggestQuerySchema = z.object({
  q: z.string().min(2, 'Autocomplete requires at least 2 characters').refine(
    (val) => val.trim().length >= 2,
    { message: 'Autocomplete requires at least 2 non-whitespace characters' }
  ),
});

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

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /search — Full-text product search
   *
   * Uses PostgreSQL full-text search with tsvector/tsquery when available,
   * falling back to ILIKE for the prototype.
   *
   * Relevance ranking: title (weight A) > description (weight B) > tags (weight C)
   * Returns max 50 results per page with pagination metadata.
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(searchQuerySchema, request);

    const searchTerm = query.q.trim();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    // Use full-text search with relevance ranking
    // Title matches are weighted highest (A=1.0), description (B=0.4), tags via metadata (C=0.2)
    // Fallback: ILIKE for cases where tsvector isn't set up
    try {
      // Attempt full-text search with ts_rank for relevance
      const tsQuery = searchTerm
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => `${term}:*`)
        .join(' & ');

      const results = await db.execute(sql`
        SELECT 
          p.*,
          ts_rank(
            setweight(to_tsvector('english', COALESCE(p.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(p.description, '')), 'B'),
            to_tsquery('english', ${tsQuery})
          ) AS relevance
        FROM products p
        WHERE p.tenant_id = ${tenantId}
          AND p.status = 'active'
          AND (
            to_tsvector('english', COALESCE(p.title, '')) ||
            to_tsvector('english', COALESCE(p.description, ''))
          ) @@ to_tsquery('english', ${tsQuery})
        ORDER BY relevance DESC, p.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      // Count total matches for pagination
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM products p
        WHERE p.tenant_id = ${tenantId}
          AND p.status = 'active'
          AND (
            to_tsvector('english', COALESCE(p.title, '')) ||
            to_tsvector('english', COALESCE(p.description, ''))
          ) @@ to_tsquery('english', ${tsQuery})
      `);

      const total = Number(countResult[0]?.total ?? 0);
      const totalPages = Math.ceil(total / limit);
      const hasMore = page < totalPages;

      return reply.send({
        data: results,
        pagination: {
          total,
          page,
          totalPages,
          hasMore,
        },
      });
    } catch {
      // Fallback to ILIKE search if full-text search fails (e.g., syntax issues)
      const likePattern = `%${searchTerm}%`;

      const results = await db.execute(sql`
        SELECT p.*,
          CASE 
            WHEN p.title ILIKE ${likePattern} THEN 3
            WHEN p.description ILIKE ${likePattern} THEN 2
            ELSE 1
          END AS relevance
        FROM products p
        WHERE p.tenant_id = ${tenantId}
          AND p.status = 'active'
          AND (
            p.title ILIKE ${likePattern}
            OR p.description ILIKE ${likePattern}
          )
        ORDER BY relevance DESC, p.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM products p
        WHERE p.tenant_id = ${tenantId}
          AND p.status = 'active'
          AND (
            p.title ILIKE ${likePattern}
            OR p.description ILIKE ${likePattern}
          )
      `);

      const total = Number(countResult[0]?.total ?? 0);
      const totalPages = Math.ceil(total / limit);
      const hasMore = page < totalPages;

      return reply.send({
        data: results,
        pagination: {
          total,
          page,
          totalPages,
          hasMore,
        },
      });
    }
  });

  /**
   * GET /search/suggest — Autocomplete suggestions
   *
   * Returns max 10 product title suggestions using prefix matching.
   * Requires minimum 2 characters for the query.
   */
  fastify.get('/suggest', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(suggestQuerySchema, request);

    const searchTerm = query.q.trim();
    const likePattern = `${searchTerm}%`;

    // Use ILIKE prefix matching for fast autocomplete
    const suggestions = await db.execute(sql`
      SELECT DISTINCT p.title
      FROM products p
      WHERE p.tenant_id = ${tenantId}
        AND p.status = 'active'
        AND p.title ILIKE ${likePattern}
      ORDER BY p.title ASC
      LIMIT 10
    `);

    return reply.send({
      data: suggestions.map((row: any) => row.title),
    });
  });
}
