import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { healthRoutes, adminRoutes, storefrontRoutes, authRoutes } from './routes/index.js';

export interface ServerOptions {
  logger?: boolean;
}

const CORRELATION_ID_HEADER = 'x-request-id';

/**
 * Builds and configures the Fastify server instance with all plugins and routes.
 * Extracted into a factory function for testability.
 */
export async function buildServer(options: ServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: options.logger ?? config.env !== 'test',
    disableRequestLogging: config.env === 'test',
    genReqId: (request) => {
      // Use incoming x-request-id header or generate a new UUID
      return (request.headers[CORRELATION_ID_HEADER] as string) || randomUUID();
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: config.cors.origin.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Tenant-Id', 'X-Session-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  // Correlation ID: set response header with the request ID
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    void reply.header(CORRELATION_ID_HEADER, request.id);
  });

  // Set up global error handler and 404 handler
  errorHandlerPlugin(fastify);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(storefrontRoutes, { prefix: '/api/v1/storefront' });

  return fastify;
}
