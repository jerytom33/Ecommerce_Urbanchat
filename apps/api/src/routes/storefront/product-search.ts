import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, sql } from '@ecommerce/database';
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

const autocompleteQuerySchema = z.object({
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

/**
 * Escapes special characters in a string for safe use in SQL LIKE/ILIKE patterns.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function productSearchRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /products/search — Full-text product search
   *
   * For the prototype, uses ILIKE pattern matching with relevance approximation:
   * - Title exact match (weight 4)
   * - Title starts with (weight 3)
   * - Title contains (weight 2)
   * - Description contains (weight 1)
   * - Tags (metadata->tags) contains (weight 1)
   *
   * Returns max 50 results per page with pagination metadata.
   */
  fastify.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(searchQuerySchema, request);

    const searchTerm = query.q.trim();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const escaped = escapeLikePattern(searchTerm);
    const containsPattern = `%${escaped}%`;
    const startsWithPattern = `${escaped}%`;

    // ILIKE-based search with relevance approximation
    // Relevance ranking: title exact > title starts with > title contains > description contains > tags contains
    const results = await db.execute(sql`
      SELECT p.*,
        CASE 
          WHEN LOWER(p.title) = LOWER(${searchTerm}) THEN 5
          WHEN p.title ILIKE ${startsWithPattern} THEN 4
          WHEN p.title ILIKE ${containsPattern} THEN 3
          WHEN p.description ILIKE ${containsPattern} THEN 2
          WHEN p.metadata::text ILIKE ${containsPattern} THEN 1
          ELSE 0
        END AS relevance
      FROM products p
      WHERE p.tenant_id = ${tenantId}::uuid
        AND p.status = 'active'
        AND (
          p.title ILIKE ${containsPattern}
          OR p.description ILIKE ${containsPattern}
          OR p.metadata::text ILIKE ${containsPattern}
        )
      ORDER BY relevance DESC, p.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    // Count total matches for pagination
    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int as total
      FROM products p
      WHERE p.tenant_id = ${tenantId}::uuid
        AND p.status = 'active'
        AND (
          p.title ILIKE ${containsPattern}
          OR p.description ILIKE ${containsPattern}
          OR p.metadata::text ILIKE ${containsPattern}
        )
    `);

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    return reply.send({
      data: results,
      pagination: {
        total,
        page,
        totalPages,
      },
    });
  });

  /**
   * GET /products/autocomplete — Autocomplete suggestions
   *
   * Returns max 10 product title suggestions using prefix matching.
   * Requires minimum 2 characters for the query.
   * Must respond in <200ms.
   */
  fastify.get('/autocomplete', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(autocompleteQuerySchema, request);

    const searchTerm = query.q.trim();
    const escaped = escapeLikePattern(searchTerm);
    const prefixPattern = `${escaped}%`;
    const containsPattern = `%${escaped}%`;

    // Use ILIKE prefix matching with fallback to contains for broader results
    // Prefix matches ranked higher than contains matches
    const suggestions = await db.execute(sql`
      SELECT DISTINCT p.title,
        CASE 
          WHEN p.title ILIKE ${prefixPattern} THEN 2
          ELSE 1
        END AS rank
      FROM products p
      WHERE p.tenant_id = ${tenantId}::uuid
        AND p.status = 'active'
        AND p.title ILIKE ${containsPattern}
      ORDER BY rank DESC, p.title ASC
      LIMIT 10
    `);

    return reply.send({
      data: suggestions.map((row: any) => row.title),
    });
  });
}
