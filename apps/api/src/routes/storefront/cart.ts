import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and } from '@ecommerce/database';
import { validateBody, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';
import {
  addToCart,
  getCart,
  removeFromCart,
  clearCart,
  updateItemQuantity,
  startReservationCleanup,
  RESERVATION_TTL_MS,
} from '../../services/cart-store.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const addToCartSchema = z.object({
  listingId: z.string().uuid('listingId must be a valid UUID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Quantity cannot exceed 100'),
});

const updateQuantitySchema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(100, 'Quantity cannot exceed 100'),
});

const listingIdParamSchema = z.object({
  listingId: z.string().uuid('listingId must be a valid UUID'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts session ID from the x-session-id header.
 * Throws AppError if missing.
 */
function getSessionId(request: FastifyRequest): string {
  const sessionId = request.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    throw new AppError(400, 'MISSING_SESSION', 'Missing x-session-id header. A session ID is required for cart operations.');
  }
  return sessionId;
}

/**
 * Extracts tenant ID from x-tenant-id header (prototype fallback).
 */
function getTenantId(request: FastifyRequest): string {
  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;

  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header.');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function cartRoutes(fastify: FastifyInstance): Promise<void> {
  // Start the reservation cleanup interval when routes are registered
  startReservationCleanup();

  /**
   * POST /cart/add — Add item to cart with stock validation and reservation
   *
   * Requirements: 7.1, 7.2
   * - Validate inventory availability
   * - Reserve stock for 15 minutes
   * - Max 50 distinct line items per cart
   * - Max 100 units per line item
   */
  fastify.post('/add', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const sessionId = getSessionId(request);
    const body = validateBody(addToCartSchema, request);

    // Validate listing exists and is active
    const listing = await db.query.listings.findFirst({
      where: and(
        eq(schema.listings.id, body.listingId),
        eq(schema.listings.tenantId, tenantId),
        eq(schema.listings.status, 'active'),
      ),
    });

    if (!listing) {
      throw new AppError(404, 'LISTING_NOT_FOUND', `Listing with id '${body.listingId}' not found or not available`);
    }

    // Add to cart with stock reservation
    const result = addToCart(
      sessionId,
      body.listingId,
      body.quantity,
      listing.inventoryQuantity,
    );

    if (!result.success) {
      const statusCode = result.errorCode === 'INSUFFICIENT_STOCK' ? 409 : 400;
      throw new AppError(statusCode, result.errorCode!, result.error!);
    }

    // Return updated cart
    const cartItems = getCart(sessionId);
    return reply.status(200).send({
      data: {
        sessionId,
        items: cartItems.map((item) => ({
          listingId: item.listingId,
          quantity: item.quantity,
          reservedAt: new Date(item.reservedAt).toISOString(),
          expiresAt: new Date(item.reservedAt + RESERVATION_TTL_MS).toISOString(),
        })),
        itemCount: cartItems.length,
      },
    });
  });

  /**
   * GET /cart — Get current cart contents with item details
   *
   * Returns items with listing details (price, title, sku), subtotal, and itemCount.
   * Expired reservations are cleaned up before returning.
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const sessionId = getSessionId(request);

    const cartItems = getCart(sessionId);

    // Fetch listing details for all items in the cart
    let subtotal = 0;
    const itemsWithDetails = await Promise.all(
      cartItems.map(async (item) => {
        const listing = await db.query.listings.findFirst({
          where: and(
            eq(schema.listings.id, item.listingId),
            eq(schema.listings.tenantId, tenantId),
          ),
        });

        if (listing) {
          subtotal += parseFloat(listing.price) * item.quantity;
        }

        return {
          listingId: item.listingId,
          quantity: item.quantity,
          price: listing ? listing.price : null,
          title: listing ? (listing as any).title || null : null,
          sku: listing ? listing.sku : null,
          reservedAt: new Date(item.reservedAt).toISOString(),
          expiresAt: new Date(item.reservedAt + RESERVATION_TTL_MS).toISOString(),
          listing: listing
            ? {
                id: listing.id,
                sku: listing.sku,
                price: listing.price,
                productId: listing.productId,
                options: listing.options,
              }
            : null,
        };
      }),
    );

    return reply.send({
      data: {
        sessionId,
        items: itemsWithDetails,
        subtotal: subtotal.toFixed(2),
        itemCount: cartItems.length,
      },
    });
  });

  /**
   * PUT /cart/items/:listingId — Update item quantity
   *
   * Body: { quantity: number (1-100) }
   * Validates stock availability for the new quantity.
   */
  fastify.put('/items/:listingId', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const sessionId = getSessionId(request);
    const { listingId } = validateParams(listingIdParamSchema, request);
    const body = validateBody(updateQuantitySchema, request);

    // Validate listing exists and is active
    const listing = await db.query.listings.findFirst({
      where: and(
        eq(schema.listings.id, listingId),
        eq(schema.listings.tenantId, tenantId),
        eq(schema.listings.status, 'active'),
      ),
    });

    if (!listing) {
      throw new AppError(404, 'LISTING_NOT_FOUND', `Listing with id '${listingId}' not found or not available`);
    }

    const result = updateItemQuantity(
      sessionId,
      listingId,
      body.quantity,
      listing.inventoryQuantity,
    );

    if (!result.success) {
      if (result.errorCode === 'ITEM_NOT_FOUND') {
        throw new AppError(404, result.errorCode, result.error!);
      }
      const statusCode = result.errorCode === 'INSUFFICIENT_STOCK' ? 409 : 400;
      throw new AppError(statusCode, result.errorCode!, result.error!);
    }

    // Return updated cart
    const cartItems = getCart(sessionId);
    return reply.send({
      data: {
        sessionId,
        items: cartItems.map((item) => ({
          listingId: item.listingId,
          quantity: item.quantity,
          reservedAt: new Date(item.reservedAt).toISOString(),
          expiresAt: new Date(item.reservedAt + RESERVATION_TTL_MS).toISOString(),
        })),
        itemCount: cartItems.length,
      },
    });
  });

  /**
   * DELETE /cart/items/:listingId — Remove item from cart, release reservation
   */
  fastify.delete('/items/:listingId', async (request: FastifyRequest, reply: FastifyReply) => {
    getTenantId(request); // Validate tenant context exists
    const sessionId = getSessionId(request);
    const { listingId } = validateParams(listingIdParamSchema, request);

    const removed = removeFromCart(sessionId, listingId);

    if (!removed) {
      throw new AppError(404, 'ITEM_NOT_FOUND', `Item with listingId '${listingId}' not found in cart`);
    }

    // Return updated cart
    const cartItems = getCart(sessionId);
    return reply.send({
      data: {
        sessionId,
        items: cartItems.map((item) => ({
          listingId: item.listingId,
          quantity: item.quantity,
          reservedAt: new Date(item.reservedAt).toISOString(),
          expiresAt: new Date(item.reservedAt + RESERVATION_TTL_MS).toISOString(),
        })),
        itemCount: cartItems.length,
      },
    });
  });

  /**
   * DELETE /cart — Clear entire cart, release all reservations
   */
  fastify.delete('/', async (request: FastifyRequest, reply: FastifyReply) => {
    getTenantId(request); // Validate tenant context exists
    const sessionId = getSessionId(request);

    clearCart(sessionId);

    return reply.send({
      data: {
        sessionId,
        items: [],
        itemCount: 0,
      },
    });
  });
}
