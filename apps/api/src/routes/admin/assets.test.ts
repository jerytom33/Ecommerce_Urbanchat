import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../server.js';
import { join } from 'node:path';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockMedia: any[] = [];
  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => ({
            catch: vi.fn(() => [{ id: 'test-uuid', tenantId: 'tenant-1', url: '/api/v1/assets/test-uuid' }]),
          })),
        })),
      })),
      query: {
        media: {
          findFirst: vi.fn(async () => null),
          findMany: vi.fn(async () => []),
        },
      },
      delete: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    },
    schema: {
      media: {
        id: 'id',
        tenantId: 'tenant_id',
        productId: 'product_id',
        url: 'url',
        altText: 'alt_text',
        mimeType: 'mime_type',
        size: 'size',
        sortOrder: 'sort_order',
        createdAt: 'created_at',
      },
    },
    eq: vi.fn(),
    and: vi.fn(),
    lt: vi.fn(),
  };
});

// Mock fs operations
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined),
    stat: vi.fn(async () => ({ size: 1024 })),
    readdir: vi.fn(async () => []),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const { PassThrough } = await import('node:stream');
  return {
    ...actual,
    createWriteStream: vi.fn(() => {
      const stream = new PassThrough();
      // Simulate successful write completion
      stream.on('pipe', () => {
        setTimeout(() => stream.emit('finish'), 10);
      });
      return stream;
    }),
    createReadStream: vi.fn(() => {
      const { Readable } = require('node:stream');
      return Readable.from(Buffer.from('test file content'));
    }),
    existsSync: vi.fn(() => false),
  };
});

// Mock stream/promises pipeline
vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(async () => undefined),
}));

// Mock sharp
vi.mock('sharp', () => {
  const mockSharp = (input: any) => ({
    resize: vi.fn().mockReturnThis(),
    toFile: vi.fn(async () => ({ width: 150, height: 150 })),
    toBuffer: vi.fn(async () => Buffer.from('resized')),
  });
  mockSharp.default = mockSharp;
  return { default: mockSharp };
});

describe('Asset Routes - POST /api/v1/admin/assets/upload', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('rejects request without tenant context', async () => {
    const form = buildMultipartPayload('test.jpg', 'image/jpeg', Buffer.from('fake-image'));

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload',
      headers: {
        ...form.headers,
      },
      payload: form.body,
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects unsupported MIME types', async () => {
    const form = buildMultipartPayload('malware.exe', 'application/x-msdownload', Buffer.from('evil'));

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload',
      headers: {
        'x-tenant-id': 'tenant-1',
        ...form.headers,
      },
      payload: form.body,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe('INVALID_FILE_TYPE');
    expect(body.error.message).toContain('Unsupported file type');
  });

  it('accepts valid JPEG upload', async () => {
    const imageBuffer = Buffer.alloc(100, 0xff);
    const form = buildMultipartPayload('photo.jpg', 'image/jpeg', imageBuffer);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload',
      headers: {
        'x-tenant-id': 'tenant-1',
        ...form.headers,
      },
      payload: form.body,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.data.mimeType).toBe('image/jpeg');
    expect(body.data.url).toContain('/api/v1/assets/');
  });

  it('accepts valid PNG upload', async () => {
    const imageBuffer = Buffer.alloc(50, 0xAB);
    const form = buildMultipartPayload('icon.png', 'image/png', imageBuffer);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload',
      headers: {
        'x-tenant-id': 'tenant-1',
        ...form.headers,
      },
      payload: form.body,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.mimeType).toBe('image/png');
  });

  it('accepts valid PDF upload', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
    const form = buildMultipartPayload('document.pdf', 'application/pdf', pdfBuffer);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload',
      headers: {
        'x-tenant-id': 'tenant-1',
        ...form.headers,
      },
      payload: form.body,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.mimeType).toBe('application/pdf');
    // PDFs shouldn't have image variants
    expect(body.data.variants).toBeUndefined();
  });

  it('accepts valid video upload', async () => {
    const videoBuffer = Buffer.alloc(200, 0x00);
    const form = buildMultipartPayload('clip.mp4', 'video/mp4', videoBuffer);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload',
      headers: {
        'x-tenant-id': 'tenant-1',
        ...form.headers,
      },
      payload: form.body,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.mimeType).toBe('video/mp4');
  });

  it('rejects request with no file', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/admin/assets/upload',
      headers: {
        'x-tenant-id': 'tenant-1',
        'content-type': 'multipart/form-data; boundary=----testboundary',
      },
      payload: '------testboundary--\r\n',
    });

    // Should get 400 for no file
    expect(response.statusCode).toBe(400);
  });
});

describe('Asset Routes - GET /api/v1/admin/assets', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('rejects request without tenant context', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/assets',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns paginated asset list', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/assets',
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toBeDefined();
    expect(body.pagination).toBeDefined();
    expect(body.pagination.hasMore).toBeDefined();
  });

  it('validates limit parameter', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/assets?limit=200',
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('Asset Routes - DELETE /api/v1/admin/assets/:id', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ logger: false });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('rejects request without tenant context', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/admin/assets/550e8400-e29b-41d4-a716-446655440000',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 404 for non-existent asset', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/admin/assets/550e8400-e29b-41d4-a716-446655440000',
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects invalid UUID parameter', async () => {
    const response = await server.inject({
      method: 'DELETE',
      url: '/api/v1/admin/assets/not-a-uuid',
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ─── Helper: Build multipart form data ────────────────────────────────────────

function buildMultipartPayload(
  filename: string,
  contentType: string,
  content: Buffer,
): { headers: Record<string, string>; body: Buffer } {
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const CRLF = '\r\n';

  const parts = [
    `--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`,
    `Content-Type: ${contentType}${CRLF}`,
    CRLF,
  ];

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  const body = Buffer.concat([header, content, footer]);

  return {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  };
}
