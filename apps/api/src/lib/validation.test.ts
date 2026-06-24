import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildServer } from '../server.js';
import { validateBody } from './validation.js';

describe('Zod Validation Integration', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildServer({ logger: false });

    // Register a test route that uses Zod validation
    const testSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Must be a valid email'),
      age: z.number().int().min(18, 'Must be at least 18'),
    });

    server.post('/test/validate', async (request, _reply) => {
      const data = validateBody(testSchema, request);
      return { success: true, data };
    });

    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('returns 400 with structured errors on invalid body', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/test/validate',
      payload: {
        name: '',
        email: 'not-an-email',
        age: 15,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Request validation failed');
    expect(body.error.request_id).toBeDefined();
    expect(body.error.details).toBeDefined();
    expect(body.error.details.length).toBeGreaterThan(0);

    // Check field error structure
    const fieldErrors = body.error.details;
    expect(fieldErrors.some((e: { field: string }) => e.field === 'name')).toBe(true);
    expect(fieldErrors.some((e: { field: string }) => e.field === 'email')).toBe(true);
    expect(fieldErrors.some((e: { field: string }) => e.field === 'age')).toBe(true);
  });

  it('passes validation with valid data', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/test/validate',
      payload: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
      age: 25,
    });
  });
});
