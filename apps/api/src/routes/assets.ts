import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createReadStream, existsSync } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validateParams, validateQuery } from '../lib/validation.js';
import { AppError } from '../plugins/error-handler.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const UPLOADS_DIR = join(process.cwd(), 'uploads');

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
};

// 30 days in seconds
const CACHE_MAX_AGE = 30 * 24 * 60 * 60;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const assetIdParamSchema = z.object({
  id: z.string().min(1, 'Asset ID is required'),
});

const resizeQuerySchema = z.object({
  w: z.coerce.number().int().min(1).max(4096).optional(),
  h: z.coerce.number().int().min(1).max(4096).optional(),
});

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Find the actual file on disk by asset ID across all tenant directories.
 * Returns the full path and extension if found.
 */
async function findAssetFile(assetId: string): Promise<{ path: string; ext: string } | null> {
  try {
    const tenantDirs = await readdir(UPLOADS_DIR);
    for (const tenantDir of tenantDirs) {
      const dirPath = join(UPLOADS_DIR, tenantDir);
      const files = await readdir(dirPath);
      const match = files.find((f) => f.startsWith(assetId));
      if (match) {
        const ext = match.split('.').pop() || '';
        return { path: join(dirPath, match), ext };
      }
    }
  } catch {
    // uploads dir doesn't exist
  }
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * Public asset serving routes — no auth required.
 * Registered under /api/v1/assets
 */
export async function publicAssetRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /assets/:id — Serve an asset file
   * Supports ?w= and ?h= query params for on-the-fly resize (1-4096px)
   * Sets cache-control headers for 30-day caching
   */
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = validateParams(assetIdParamSchema, request);
    const { w, h } = validateQuery(resizeQuerySchema, request);

    const asset = await findAssetFile(id);
    if (!asset) {
      throw new AppError(404, 'NOT_FOUND', `Asset '${id}' not found`);
    }

    const mimeType = MIME_TYPES[asset.ext] || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/');

    // Set cache headers
    void reply.header('Cache-Control', `public, max-age=${CACHE_MAX_AGE}, immutable`);
    void reply.header('Content-Type', mimeType);

    // On-the-fly resize for images with ?w= or ?h= params
    if (isImage && (w || h)) {
      try {
        const sharp = await import('sharp');
        const sharpModule = sharp.default || sharp;
        const resized = await (sharpModule as any)(asset.path)
          .resize({ width: w, height: h, fit: 'inside', withoutEnlargement: true })
          .toBuffer();

        void reply.header('Content-Length', resized.length);
        return reply.send(resized);
      } catch {
        // If sharp isn't available or resize fails, serve original
      }
    }

    // Serve original file
    const fileStat = await stat(asset.path);
    void reply.header('Content-Length', fileStat.size);

    const stream = createReadStream(asset.path);
    return reply.send(stream);
  });
}
