import { FastifyInstance } from 'fastify';
import { productRoutes } from './products.js';
import { categoryRoutes } from './categories.js';
import { listingProductRoutes, listingRoutes } from './listings.js';
import { customerRoutes } from './customers.js';
import { themeRoutes } from './themes.js';
import { promotionRoutes } from './promotions.js';
import { assetRoutes } from './assets.js';
import { fulfillmentRoutes } from './fulfillment.js';
import { orderRoutes } from './orders.js';

/**
 * Admin API routes registered under /api/v1/admin/
 * These routes serve the merchant-facing Admin Panel.
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, _reply) => {
    return { message: 'Admin API v1' };
  });

  // Product management routes
  await fastify.register(productRoutes, { prefix: '/products' });

  // Category management routes
  await fastify.register(categoryRoutes, { prefix: '/categories' });

  // Listing management routes (nested under products)
  await fastify.register(listingProductRoutes, { prefix: '/products/:productId/listings' });

  // Listing direct operations (update, delete)
  await fastify.register(listingRoutes, { prefix: '/listings' });

  // Customer management routes
  await fastify.register(customerRoutes, { prefix: '/customers' });

  // Theme management routes
  await fastify.register(themeRoutes, { prefix: '/themes' });

  // Promotion management routes
  await fastify.register(promotionRoutes, { prefix: '/promotions' });

  // Asset management routes
  await fastify.register(assetRoutes, { prefix: '/assets' });

  // Fulfillment management routes (nested under orders)
  await fastify.register(fulfillmentRoutes, { prefix: '/orders' });

  // Order management routes (list, get details)
  await fastify.register(orderRoutes, { prefix: '/orders' });
}
