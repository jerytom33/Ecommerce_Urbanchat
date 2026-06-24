import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../server.js';
import { FastifyInstance } from 'fastify';

// Mock data
const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CATEGORY_ID = '11111111-1111-1111-1111-111111111111';
const PARENT_ID = '22222222-2222-2222-2222-222222222222';
const CHILD_ID = '33333333-3333-3333-3333-333333333333';

const mockRootCategory = {
  id: CATEGORY_ID,
  tenantId: TENANT_ID,
  name: 'Electronics',
  parentId: null,
  path: CATEGORY_ID,
  depth: 0,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockParentCategory = {
  id: PARENT_ID,
  tenantId: TENANT_ID,
  name: 'Computers',
  parentId: CATEGORY_ID,
  path: `${CATEGORY_ID}.${PARENT_ID}`,
  depth: 1,
  createdAt: new Date('2024-01-02T00:00:00Z'),
  updatedAt: new Date('2024-01-02T00:00:00Z'),
};

const mockChildCategory = {
  id: CHILD_ID,
  tenantId: TENANT_ID,
  name: 'Laptops',
  parentId: PARENT_ID,
  path: `${CATEGORY_ID}.${PARENT_ID}.${CHILD_ID}`,
  depth: 2,
  createdAt: new Date('2024-01-03T00:00:00Z'),
  updatedAt: new Date('2024-01-03T00:00:00Z'),
};

// Chain builder for flexible mock control
let selectResults: any[][] = [];
let selectCallIndex = 0;
let insertResult: any[] = [];
let updateResult: any[] = [];
let deleteResult: any[] = [];

// Track calls for assertions
let selectCalls = 0;

vi.mock('@ecommerce/database', () => {
  // Select chain mock
  const mockOrderBy = vi.fn().mockImplementation(() => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    selectCalls++;
    return Promise.resolve(result);
  });
  const mockSelectLimit = vi.fn().mockImplementation(() => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    selectCalls++;
    return Promise.resolve(result);
  });
  const mockSelectWhere = vi.fn().mockImplementation(() => {
    return {
      limit: mockSelectLimit,
      orderBy: mockOrderBy,
    };
  });
  const mockSelectFrom = vi.fn().mockImplementation(() => {
    return {
      where: mockSelectWhere,
      orderBy: mockOrderBy,
    };
  });
  const mockSelect = vi.fn().mockImplementation(() => {
    return { from: mockSelectFrom };
  });

  // Insert chain mock
  const mockInsertReturning = vi.fn().mockImplementation(() => {
    return Promise.resolve(insertResult);
  });
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  // Update chain mock
  const mockUpdateReturning = vi.fn().mockImplementation(() => {
    return Promise.resolve(updateResult);
  });
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  // Delete chain mock
  const mockDeleteWhere = vi.fn().mockImplementation(() => {
    return Promise.resolve(deleteResult);
  });
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  const db = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    query: {
      products: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
      listings: { findMany: vi.fn().mockResolvedValue([]) },
      media: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };

  const schemaExports = {
    categories: {
      id: 'id',
      tenantId: 'tenant_id',
      name: 'name',
      parentId: 'parent_id',
      path: 'path',
      depth: 'depth',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    products: {
      id: 'id',
      tenantId: 'tenant_id',
      title: 'title',
      description: 'description',
      status: 'status',
      categoryId: 'category_id',
      metadata: 'metadata',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    listings: {
      id: 'id',
      tenantId: 'tenant_id',
      productId: 'product_id',
    },
    media: {
      id: 'id',
      tenantId: 'tenant_id',
      productId: 'product_id',
      sortOrder: 'sort_order',
    },
    users: {
      id: 'id',
      email: 'email',
      tenantId: 'tenant_id',
      passwordHash: 'password_hash',
      role: 'role',
      firstName: 'first_name',
      lastName: 'last_name',
      createdAt: 'created_at',
    },
    refreshTokens: {
      id: 'id',
      userId: 'user_id',
      token: 'token',
      expiresAt: 'expires_at',
      revoked: 'revoked',
      createdAt: 'created_at',
    },
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

describe('Category Management Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    selectResults = [];
    selectCallIndex = 0;
    insertResult = [];
    updateResult = [];
    deleteResult = [];
    selectCalls = 0;
    app = await buildServer({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /api/v1/admin/categories', () => {
    it('should create a root category with valid input', async () => {
      const newCategory = {
        id: '55555555-5555-5555-5555-555555555555',
        tenantId: TENANT_ID,
        name: 'Electronics',
        parentId: null,
        path: 'placeholder',
        depth: 0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      insertResult = [newCategory];
      updateResult = [{ ...newCategory, path: '55555555-5555-5555-5555-555555555555' }];

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'Electronics' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.category).toBeDefined();
      expect(body.category.name).toBe('Electronics');
      expect(body.category.depth).toBe(0);
      expect(body.category.parentId).toBeNull();
    });

    it('should create a child category with valid parentId', async () => {
      // First select returns parent category
      selectResults = [[mockRootCategory]];
      const newChild = {
        id: '66666666-6666-6666-6666-666666666666',
        tenantId: TENANT_ID,
        name: 'Phones',
        parentId: CATEGORY_ID,
        path: 'placeholder',
        depth: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };
      insertResult = [newChild];
      updateResult = [{ ...newChild, path: `${CATEGORY_ID}.66666666-6666-6666-6666-666666666666` }];

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'Phones', parentId: CATEGORY_ID },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.category.depth).toBe(1);
      expect(body.category.parentId).toBe(CATEGORY_ID);
    });

    it('should return 400 when name is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is empty string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name exceeds 128 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'a'.repeat(129) },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when parentId is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'Test', parentId: 'not-a-uuid' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when parent does not exist', async () => {
      selectResults = [[]]; // No parent found

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'Orphan', parentId: '99999999-9999-9999-9999-999999999999' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('PARENT_NOT_FOUND');
    });

    it('should return 400 when max depth is exceeded (parent at depth 4)', async () => {
      const deepParent = {
        ...mockRootCategory,
        id: '99999999-9999-9999-9999-999999999999',
        depth: 4, // Max depth - no children allowed
      };
      selectResults = [[deepParent]];

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'Too Deep', parentId: '99999999-9999-9999-9999-999999999999' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('MAX_DEPTH_EXCEEDED');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/categories',
        payload: { name: 'No Tenant' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/admin/categories', () => {
    it('should list categories in flat format by default', async () => {
      selectResults = [[mockRootCategory, mockParentCategory, mockChildCategory]];

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.categories).toBeDefined();
      expect(body.format).toBe('flat');
      expect(Array.isArray(body.categories)).toBe(true);
    });

    it('should list categories in tree format', async () => {
      selectResults = [[mockRootCategory, mockParentCategory, mockChildCategory]];

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/categories?format=tree',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.format).toBe('tree');
      expect(body.categories).toBeDefined();
    });

    it('should return empty array when no categories exist', async () => {
      selectResults = [[]];

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/categories',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.categories).toEqual([]);
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/categories',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/admin/categories/:id', () => {
    it('should return a category with its children', async () => {
      selectResults = [[mockRootCategory], [mockParentCategory]]; // First: category found, Second: children

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/categories/${CATEGORY_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.category).toBeDefined();
      expect(body.category.id).toBe(CATEGORY_ID);
      expect(body.children).toBeDefined();
    });

    it('should return 404 when category does not exist', async () => {
      selectResults = [[]]; // No category found

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/categories/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/categories/not-a-uuid',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/v1/admin/categories/:id', () => {
    it('should update category name', async () => {
      selectResults = [[mockRootCategory]]; // Category exists
      updateResult = [{ ...mockRootCategory, name: 'Updated Name', updatedAt: new Date() }];

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/categories/${CATEGORY_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.category).toBeDefined();
      expect(body.category.name).toBe('Updated Name');
    });

    it('should return 404 when category does not exist', async () => {
      selectResults = [[]]; // Not found

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/admin/categories/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('should return 400 when name is empty', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/categories/${CATEGORY_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name exceeds 128 characters', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/admin/categories/${CATEGORY_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
        payload: { name: 'a'.repeat(129) },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/admin/categories/:id', () => {
    it('should delete a category with no children or products', async () => {
      // 1st select: category exists, 2nd: no children, 3rd: no products
      selectResults = [[mockRootCategory], [], []];

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/categories/${CATEGORY_ID}`,
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 when category does not exist', async () => {
      selectResults = [[]]; // Not found

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/categories/99999999-9999-9999-9999-999999999999',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('CATEGORY_NOT_FOUND');
    });

    it('should return 400 when id is not a valid UUID', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/admin/categories/invalid-id',
        headers: { 'x-tenant-id': TENANT_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no tenant context is provided', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/admin/categories/${CATEGORY_ID}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
