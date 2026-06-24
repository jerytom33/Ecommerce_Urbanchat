import { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';

/**
 * Structured field-level error detail.
 */
export interface FieldError {
  field: string;
  constraint: string;
  message: string;
}

/**
 * Structured API error response matching the platform's ApiError interface.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: FieldError[];
  };
}

/**
 * Custom application error that maps to a structured API response.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Type guard to detect ZodError by duck-typing (avoids instanceof issues across module boundaries).
 */
function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (error instanceof Error && error.name === 'ZodError' && 'issues' in error)
  );
}

/**
 * Converts a ZodError into structured field-level error details.
 */
function zodErrorToFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    constraint: issue.code,
    message: issue.message,
  }));
}

/**
 * Configures global error handler and not-found handler on the Fastify instance.
 * Applied directly (not as a plugin) to avoid encapsulation scope issues.
 */
export function errorHandlerPlugin(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id || 'unknown';

    // Handle Zod validation errors
    if (isZodError(error)) {
      const response: ApiErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          request_id: requestId,
          details: zodErrorToFieldErrors(error as unknown as ZodError),
        },
      };
      return reply.status(400).send(response);
    }

    // Handle custom application errors
    if (error instanceof AppError) {
      const response: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          request_id: requestId,
          details: error.details,
        },
      };
      return reply.status(error.statusCode).send(response);
    }

    // Handle Fastify validation errors (schema validation)
    if (error.validation) {
      const details: FieldError[] = error.validation.map((v) => ({
        field: v.instancePath || (v.params?.missingProperty as string) || 'unknown',
        constraint: v.keyword,
        message: v.message || 'Validation failed',
      }));

      const response: ApiErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          request_id: requestId,
          details,
        },
      };
      return reply.status(400).send(response);
    }

    // Handle 404 errors
    if (error.statusCode === 404) {
      const response: ApiErrorResponse = {
        error: {
          code: 'NOT_FOUND',
          message: error.message || 'Resource not found',
          request_id: requestId,
        },
      };
      return reply.status(404).send(response);
    }

    // Fallback: unexpected errors
    const statusCode = error.statusCode || 500;
    const response: ApiErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
        request_id: requestId,
      },
    };

    // Log full error details in development
    if (process.env.NODE_ENV !== 'production') {
      fastify.log.error(error);
    }

    return reply.status(statusCode).send(response);
  });

  // Handle 404 for unmatched routes
  fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id || 'unknown';
    const response: ApiErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        request_id: requestId,
      },
    };
    return reply.status(404).send(response);
  });
}
