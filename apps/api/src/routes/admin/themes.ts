import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and } from '@ecommerce/database';
import { validateParams, validateBody } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const themeIdParamSchema = z.object({
  id: z.string().uuid('Theme ID must be a valid UUID'),
});

const previewBodySchema = z.object({
  customizations: z.record(z.unknown()).optional(),
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

export async function themeRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /themes — List all available themes
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    getTenantId(request); // Ensure tenant context exists

    const allThemes = await db.query.themes.findMany({
      orderBy: (themes, { asc }) => [asc(themes.name)],
    });

    return reply.send({ data: allThemes });
  });

  /**
   * GET /themes/active — Get the currently active theme and its customizations for the tenant
   * NOTE: This route must be registered before /:id to avoid route conflict
   */
  fastify.get('/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);

    const activeCustomization = await db.query.themeCustomizations.findFirst({
      where: and(
        eq(schema.themeCustomizations.tenantId, tenantId),
        eq(schema.themeCustomizations.isActive, 'true'),
      ),
    });

    if (!activeCustomization) {
      throw new AppError(404, 'NOT_FOUND', 'No active theme found for this tenant');
    }

    // Fetch the base theme details
    const theme = await db.query.themes.findFirst({
      where: eq(schema.themes.id, activeCustomization.themeId),
    });

    if (!theme) {
      throw new AppError(404, 'NOT_FOUND', 'Active theme reference is invalid');
    }

    return reply.send({
      data: {
        theme,
        customizations: activeCustomization.customizations,
        appliedAt: activeCustomization.updatedAt,
      },
    });
  });

  /**
   * GET /themes/:id — Get theme details with full config
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    getTenantId(request); // Ensure tenant context exists
    const { id } = validateParams(themeIdParamSchema, request);

    const theme = await db.query.themes.findFirst({
      where: eq(schema.themes.id, id),
    });

    if (!theme) {
      throw new AppError(404, 'NOT_FOUND', `Theme with id '${id}' not found`);
    }

    return reply.send({ data: theme });
  });

  /**
   * POST /themes/:id/preview — Generate preview data
   * Returns theme config merged with merchant customizations (existing or provided)
   */
  fastify.post('/:id/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(themeIdParamSchema, request);
    const body = validateBody(previewBodySchema, request);

    const theme = await db.query.themes.findFirst({
      where: eq(schema.themes.id, id),
    });

    if (!theme) {
      throw new AppError(404, 'NOT_FOUND', `Theme with id '${id}' not found`);
    }

    // Get existing customizations for this tenant+theme if any
    const existingCustomization = await db.query.themeCustomizations.findFirst({
      where: and(
        eq(schema.themeCustomizations.tenantId, tenantId),
        eq(schema.themeCustomizations.themeId, id),
      ),
    });

    // Merge: base theme config + saved customizations + preview overrides
    const savedCustomizations = (existingCustomization?.customizations as Record<string, unknown>) || {};
    const previewOverrides = body.customizations || {};

    const mergedConfig = {
      templateConfig: theme.templateConfig,
      colorPalette: {
        ...(theme.colorPalette as Record<string, unknown>),
        ...savedCustomizations,
        ...previewOverrides,
      },
      fontConfig: theme.fontConfig,
    };

    return reply.send({
      data: {
        themeId: theme.id,
        themeName: theme.name,
        preview: mergedConfig,
        generatedAt: new Date().toISOString(),
      },
    });
  });

  /**
   * POST /themes/:id/apply — Apply theme to merchant's storefront
   * Creates/updates theme_customizations with is_active=true, deactivates other themes
   */
  fastify.post('/:id/apply', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(themeIdParamSchema, request);

    const theme = await db.query.themes.findFirst({
      where: eq(schema.themes.id, id),
    });

    if (!theme) {
      throw new AppError(404, 'NOT_FOUND', `Theme with id '${id}' not found`);
    }

    // Deactivate all currently active themes for this tenant
    await db
      .update(schema.themeCustomizations)
      .set({ isActive: 'false', updatedAt: new Date() })
      .where(and(
        eq(schema.themeCustomizations.tenantId, tenantId),
        eq(schema.themeCustomizations.isActive, 'true'),
      ));

    // Check if tenant already has a customization record for this theme
    const existingCustomization = await db.query.themeCustomizations.findFirst({
      where: and(
        eq(schema.themeCustomizations.tenantId, tenantId),
        eq(schema.themeCustomizations.themeId, id),
      ),
    });

    let customization;

    if (existingCustomization) {
      // Reactivate existing customization record
      const [updated] = await db
        .update(schema.themeCustomizations)
        .set({ isActive: 'true', updatedAt: new Date() })
        .where(eq(schema.themeCustomizations.id, existingCustomization.id))
        .returning();
      customization = updated;
    } else {
      // Create new customization record
      const [created] = await db
        .insert(schema.themeCustomizations)
        .values({
          tenantId,
          themeId: id,
          customizations: {},
          isActive: 'true',
        })
        .returning();
      customization = created;
    }

    return reply.send({
      data: {
        theme,
        customization,
        publishedAt: new Date().toISOString(),
        message: `Theme '${theme.name}' is now active on your storefront`,
      },
    });
  });
}
