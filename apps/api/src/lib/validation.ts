import { FastifyRequest } from 'fastify';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validates request body against a Zod schema.
 * Throws a ZodError on validation failure which is caught by the error handler.
 */
export function validateBody<T>(schema: ZodSchema<T>, request: FastifyRequest): T {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

/**
 * Validates request query parameters against a Zod schema.
 * Throws a ZodError on validation failure which is caught by the error handler.
 */
export function validateQuery<T>(schema: ZodSchema<T>, request: FastifyRequest): T {
  const result = schema.safeParse(request.query);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

/**
 * Validates request route parameters against a Zod schema.
 * Throws a ZodError on validation failure which is caught by the error handler.
 */
export function validateParams<T>(schema: ZodSchema<T>, request: FastifyRequest): T {
  const result = schema.safeParse(request.params);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export { ZodError };
