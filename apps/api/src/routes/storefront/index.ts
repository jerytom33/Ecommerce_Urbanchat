import { FastifyInstance } from 'fastify';
import { storefrontPromotionRoutes } from './promotions.js';
import { searchRoutes } from './search.js';
import { productSearchRoutes } from './product-search.js';
import { cartRoutes } from './cart.js';

/**
 * Storefront API routes registered under /api/v1/storefront/
 * These routes serve the customer-facing storefronts.
 */
export async function storefrontRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, _reply) => {
    return { message: 'Storefront API v1' };
  });

  // Cart routes
  await fastify.register(cartRoutes, { prefix: '/cart' });

  // Promotion/coupon routes (includes /cart/apply-coupon)
  await fastify.register(storefrontPromotionRoutes);

  // Search and discovery routes (legacy)
  await fastify.register(searchRoutes, { prefix: '/search' });

  // Product search and autocomplete routes
  await fastify.register(productSearchRoutes, { prefix: '/products' });
}
