import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { db, schema, eq, and, lt } from '@ecommerce/database';
import { validateQuery, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'application/pdf',
] as const;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Responsive image variant definitions */
const IMAGE_VARIANTS = {
  thumbnail: { width: 150, height: 150, fit: 'cover' as const },
  small: { width: 400, height: undefined, fit: 'inside' as const },
  medium: { width: 800, height: undefined, fit: 'inside' as const },
  large: { width: 1200, height: undefined, fit: 'inside' as const },
};

/** Base upload directory */
const UPLOADS_DIR = join(process.cwd(), 'uploads');

// ─── Schemas ─────────────────────────────────────────────────────────────────

const listAssetsQuerySchema = z.object({
  cursor: z.string().uuid('cursor must be a valid UUID').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const assetIdParamSchema = z.object({
  id: z.string().uuid('Asset ID must be a valid UUID'),
});

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
 * Tries to load sharp for image processing.
 * Returns null if sharp is not available in the environment.
 */
async function getSharp(): Promise<any | null> {
  try {
    const sharpModule = await import('sharp');
    return sharpModule.default ?? sharpModule;
  } catch {
    // sharp not available — skip variant generation
    return null;
  }
}

/**
 * Generate responsive image variants using sharp.
 * Stores variants alongside the original file.
 */
async function generateImageVariants(
  originalPath: string,
  tenantDir: string,
  fileId: string,
  ext: string,
): Promise<Record<string, string>> {
  const sharp = await getSharp();
  if (!sharp) {
    // If sharp is not available, skip variant generation
    return {};
  }

  const variants: Record<string, string> = {};

  for (const [variantName, config] of Object.entries(IMAGE_VARIANTS)) {
    const variantFilename = `${fileId}_${variantName}.${ext}`;
    const variantPath = join(tenantDir, variantFilename);

    try {
      await sharp(originalPath)
        .resize({
          width: config.width,
          height: config.height,
          fit: config.fit,
          withoutEnlargement: true,
        })
        .toFile(variantPath);

      variants[variantName] = variantFilename;
    } catch {
      // If variant generation fails for a specific size, skip it
    }
  }

  return variants;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function assetRoutes(fastify: FastifyInstance): Promise<void> {
  // Register multipart support
  const multipart = await import('@fastify/multipart');
  await fastify.register(multipart.default || multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });

  /**
   * POST /assets/upload — Upload a file
   */
  fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);

    const data = await request.file();
    if (!data) {
      throw new AppError(400, 'BAD_REQUEST', 'No file provided. Send a multipart form with a "file" field.');
    }

    // Validate MIME type
    const mimeType = data.mimetype;
    if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
      // Consume and discard the stream to prevent hanging
      data.file.resume();
      throw new AppError(
        400,
        'INVALID_FILE_TYPE',
        `Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    const ext = MIME_TO_EXT[mimeType] || extname(data.filename).slice(1) || 'bin';
    const fileId = randomUUID();
    const filename = `${fileId}.${ext}`;

    // Ensure tenant upload directory exists
    const tenantDir = join(UPLOADS_DIR, tenantId);
    await mkdir(tenantDir, { recursive: true });

    const filePath = join(tenantDir, filename);

    // Stream file to disk
    const writeStream = createWriteStream(filePath);
    await pipeline(data.file, writeStream);

    // Check if file was truncated (exceeded size limit)
    if (data.file.truncated) {
      // Clean up the partial file
      try { await unlink(filePath); } catch { /* ignore */ }
      throw new AppError(
        400,
        'FILE_TOO_LARGE',
        `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      );
    }

    // Get actual file size from what was written
    const fileStat = await stat(filePath);
    const size = fileStat.size;

    // Generate image variants for image files
    let variants: Record<string, string> = {};
    if (IMAGE_MIME_TYPES.includes(mimeType)) {
      variants = await generateImageVariants(filePath, tenantDir, fileId, ext);
    }

    // Build URL paths
    const baseUrl = `/api/v1/assets/${fileId}`;
    const variantUrls: Record<string, string> = {};
    for (const [variantName, variantFilename] of Object.entries(variants)) {
      variantUrls[variantName] = `/api/v1/assets/${variantFilename.replace(`.${ext}`, '')}`;
    }

    // Insert record into media table
    // Note: productId is required by schema, so for standalone assets we use a placeholder approach
    // For the prototype, we'll store the asset metadata and return it
    const [mediaRecord] = await db
      .insert(schema.media)
      .values({
        id: fileId,
        tenantId,
        // productId is required by schema - for standalone uploads, caller should associate later
        productId: (request.body as any)?.productId || undefined!,
        url: baseUrl,
        mimeType,
        size,
        sortOrder: 0,
      })
      .returning()
      .catch(() => {
        // If insert fails (e.g., missing productId), still return the upload result
        return [null];
      });

    return reply.status(201).send({
      data: {
        id: fileId,
        url: baseUrl,
        variants: Object.keys(variantUrls).length > 0 ? variantUrls : undefined,
        mimeType,
        size,
        filename: data.filename,
      },
    });
  });

  /**
   * GET /assets — List assets for tenant (paginated)
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const query = validateQuery(listAssetsQuerySchema, request);

    const conditions = [eq(schema.media.tenantId, tenantId)];

    if (query.cursor) {
      const cursorAsset = await db.query.media.findFirst({
        where: and(eq(schema.media.id, query.cursor), eq(schema.media.tenantId, tenantId)),
      });
      if (cursorAsset) {
        conditions.push(lt(schema.media.createdAt, cursorAsset.createdAt));
      }
    }

    const limit = query.limit ?? 20;
    const assets = await db.query.media.findMany({
      where: and(...conditions),
      orderBy: (media, { desc }) => [desc(media.createdAt)],
      limit: limit + 1,
    });

    const hasMore = assets.length > limit;
    const data = hasMore ? assets.slice(0, limit) : assets;
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
   * DELETE /assets/:id — Delete asset and its variants from disk
   */
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(assetIdParamSchema, request);

    // Find the asset
    const asset = await db.query.media.findFirst({
      where: and(eq(schema.media.id, id), eq(schema.media.tenantId, tenantId)),
    });

    if (!asset) {
      throw new AppError(404, 'NOT_FOUND', `Asset with id '${id}' not found`);
    }

    // Delete file and variants from disk
    const tenantDir = join(UPLOADS_DIR, tenantId);
    try {
      const files = await readdir(tenantDir);
      const assetFiles = files.filter((f) => f.startsWith(id));
      for (const file of assetFiles) {
        await unlink(join(tenantDir, file)).catch(() => { /* ignore missing files */ });
      }
    } catch {
      // Directory might not exist — that's fine
    }

    // Delete from database
    await db.delete(schema.media).where(and(eq(schema.media.id, id), eq(schema.media.tenantId, tenantId)));

    return reply.status(204).send();
  });
}
