import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

// Mock the database module
vi.mock('@ecommerce/database', () => {
  const mockThemes = [
    {
      id: 'aaaaaaaa-1111-1111-1111-111111111111',
      name: 'Bold',
      templateConfig: { layout: 'full-width', headerStyle: 'overlay' },
      colorPalette: { primary: '#F97316', background: '#0F172A', text: '#F8FAFC' },
      fontConfig: { heading: 'Poppins', body: 'Poppins', headingWeight: '800' },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
    {
      id: 'aaaaaaaa-2222-2222-2222-222222222222',
      name: 'Classic',
      templateConfig: { layout: 'contained', headerStyle: 'simple' },
      colorPalette: { primary: '#2C3E50', background: '#FFFFFF', text: '#2C3E50' },
      fontConfig: { heading: 'Georgia, serif', body: 'system-ui', headingWeight: '600' },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
    {
      id: 'aaaaaaaa-3333-3333-3333-333333333333',
      name: 'Modern',
      templateConfig: { layout: 'full-width', headerStyle: 'sticky' },
      colorPalette: { primary: '#4F46E5', background: '#FFFFFF', text: '#111827' },
      fontConfig: { heading: 'Inter', body: 'Inter', headingWeight: '700' },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    },
  ];

  const mockCustomization = {
    id: 'cccccccc-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    themeId: 'aaaaaaaa-3333-3333-3333-333333333333',
    customizations: { primary: '#FF0000' },
    isActive: 'true',
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  const mockThemesFindMany = vi.fn().mockResolvedValue(mockThemes);
  const mockThemesFindFirst = vi.fn().mockImplementation(() => Promise.resolve(mockThemes[2]));
  const mockCustomizationsFindFirst = vi.fn().mockImplementation(() => Promise.resolve(mockCustomization));

  // Insert mock
  const mockInsertReturning = vi.fn().mockResolvedValue([{
    id: 'dddddddd-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    themeId: 'aaaaaaaa-3333-3333-3333-333333333333',
    customizations: {},
    isActive: 'true',
    createdAt: new Date('2024-01-03T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  }]);
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  // Update mock
  const mockUpdateReturning = vi.fn().mockResolvedValue([{
    id: 'cccccccc-1111-1111-1111-111111111111',
    tenantId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    themeId: 'aaaaaaaa-3333-3333-3333-333333333333',
    customizations: { primary: '#FF0000' },
    isActive: 'true',
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-03T00:00:00Z'),
  }]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const db = {
    insert: mockInsert,
    update: mockUpdate,
    query: {
      themes: {
        findMany: mockThemesFindMany,
        findFirst: mockThemesFindFirst,
      },
      themeCustomizations: {
        findFirst: mockCustomizationsFindFirst,
      },
      // Required for other routes registered in admin
      products: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      listings: { findMany: vi.fn().mockResolvedValue([]) },
      media: { findMany: vi.fn().mockResolvedValue([]) },
      categories: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      customers: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    },
  };

  const schemaExports = {
    themes: { id: 'id', name: 'name' },
    themeCustomizations: {
      id: 'id',
      tenantId: 'tenant_id',
      themeId: 'theme_id',
      isActive: 'is_active',
    },
    products: { id: 'id', tenantId: 'tenant_id', title: 'title', status: 'status', createdAt: 'created_at' },
    listings: { id: 'id', tenantId: 'tenant_id', productId: 'product_id' },
    media: { id: 'id', tenantId: 'tenant_id', productId: 'product_id', sortOrder: 'sort_order' },
    categories: { id: 'id', tenantId: 'tenant_id', name: 'name', depth: 'depth', parentId: 'parent_id' },
    customers: { id: 'id', tenantId: 'tenant_id' },
  };

  return {
    db,
    schema: schemaExports,
    eq: vi.fn().mockReturnValue(true),
    and: vi.fn().mockReturnValue(true),
    or: vi.fn().mockReturnValue(true),
    ne: vi.fn().mockReturnValue(true),
    gt: vi.fn().mockReturnValue(true),
    gte: vi.fn().mockReturnValue(true),
    lt: vi.fn().mockReturnValue(true),
    lte: vi.fn().mockReturnValue(true),
    like: vi.fn().mockReturnValue(true),
    ilike: vi.fn().mockReturnValue(true),
    inArray: vi.fn().mockReturnValue(true),
    sql: vi.fn().mockReturnValue(true),
  };
});

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('Theme Management Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/admin/themes', () => {
    it('should list all available themes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(3);
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/admin/themes/:id', () => {
    it('should return theme details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes/aaaaaaaa-3333-3333-3333-333333333333',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.name).toBe('Modern');
      expect(body.data.colorPalette).toBeDefined();
      expect(body.data.fontConfig).toBeDefined();
    });

    it('should return 404 when theme does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.themes.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes/not-a-uuid',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/admin/themes/active', () => {
    it('should return the active theme with customizations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes/active',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.theme).toBeDefined();
      expect(body.data.customizations).toBeDefined();
      expect(body.data.appliedAt).toBeDefined();
    });

    it('should return 404 when no active theme exists', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.themeCustomizations.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes/active',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/themes/active',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/admin/themes/:id/preview', () => {
    it('should return preview data with merged config', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/aaaaaaaa-3333-3333-3333-333333333333/preview',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.themeId).toBe('aaaaaaaa-3333-3333-3333-333333333333');
      expect(body.data.themeName).toBe('Modern');
      expect(body.data.preview).toBeDefined();
      expect(body.data.preview.colorPalette).toBeDefined();
      expect(body.data.preview.fontConfig).toBeDefined();
      expect(body.data.generatedAt).toBeDefined();
    });

    it('should accept customizations override in preview', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/aaaaaaaa-3333-3333-3333-333333333333/preview',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {
          customizations: { primary: '#00FF00' },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.preview.colorPalette.primary).toBe('#00FF00');
    });

    it('should return 404 when theme does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.themes.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/99999999-9999-9999-9999-999999999999/preview',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {},
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/aaaaaaaa-3333-3333-3333-333333333333/preview',
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/admin/themes/:id/apply', () => {
    it('should apply theme and return success response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/aaaaaaaa-3333-3333-3333-333333333333/apply',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.theme).toBeDefined();
      expect(body.data.customization).toBeDefined();
      expect(body.data.publishedAt).toBeDefined();
      expect(body.data.message).toContain('Modern');
    });

    it('should return 404 when theme does not exist', async () => {
      const { db } = await import('@ecommerce/database');
      (db.query.themes.findFirst as any).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/99999999-9999-9999-9999-999999999999/apply',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/invalid-id/apply',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/themes/aaaaaaaa-3333-3333-3333-333333333333/apply',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
