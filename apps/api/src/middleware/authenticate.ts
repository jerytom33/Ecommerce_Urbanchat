import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../plugins/error-handler.js';

/**
 * Decoded JWT payload attached to the request after authentication.
 */
export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: string;
}

/**
 * Augment the Fastify request interface to include the authenticated user payload.
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthPayload;
  }
}

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Fastify preHandler hook that validates the JWT access token from the
 * Authorization: Bearer <token> header.
 *
 * On success, attaches the decoded payload ({ userId, tenantId, role }) to request.user.
 * On failure, throws an AppError with HTTP 401 and a machine-readable error code.
 *
 * Error codes:
 * - TOKEN_MISSING: No Authorization header or not Bearer scheme
 * - TOKEN_EXPIRED: Token has expired
 * - TOKEN_INVALID: Token is malformed or signature verification failed
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractBearerToken(request);

  if (!token) {
    throw new AppError(401, 'TOKEN_MISSING', 'Authorization header with Bearer token is required');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthPayload;

    // Attach the decoded payload to the request
    request.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    }

    throw new AppError(401, 'TOKEN_INVALID', 'Access token is invalid or malformed');
  }
}
