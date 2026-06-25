import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, sql } from '@ecommerce/database';
import { validateBody, validateParams } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';
import { getCart, clearCart } from '../../services/cart-store.js';
import { upsertCustomerFromOrder } from '../admin/customers.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const TAX_RATE = 0.08; // Flat 8% tax for prototype
const SHIPPING_FLAT = 5.99; // Flat shipping for prototype

// ─── Schemas ─────────────────────────────────────────────────────────────────

const shippingAddressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required').max(255),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  zip: z.string().min(1, 'ZIP code is required').max(20),
  country: z.string().min(1, 'Country is required').max(100),
});

const paymentMethodSchema = z.object({
  type: z.literal('card'),
  last4: z.string().length(4, 'last4 must be exactly 4 digits').regex(/^\d{4}$/, 'last4 must be 4 digits'),
  brand: z.string().min(1, 'Card brand is required').max(50),
});

const paySchema = z.object({
  email: z.string().email('A valid email is required'),
  shippingAddress: shippingAddressSchema,
  paymentMethod: paymentMethodSchema,
});

const orderIdParamSchema = z.object({
  id: z.string().uuid('Order ID must be a valid UUID'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSessionId(request: FastifyRequest): string {
  const sessionId = request.headers['x-session-id'] as string | undefined;
  if (!sessionId) {
    throw new AppError(400, 'MISSING_SESSION', 'Missing x-session-id header.');
  }
  return sessionId;
}

function getTenantId(request: FastifyRequest): string {
  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;
  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header.');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function checkoutRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /checkout/initiate — Start checkout, calculate price summary
   *
   * Requirements: 7.3, 7.4
   * - Gets cart from in-memory store using x-session-id
   * - Fetches listing details for all cart items
   * - Calculates subtotal, tax (8%), shipping ($5.99), discount
   * - Returns itemized summary
   */
  fastify.post('/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const sessionId = getSessionId(request);

    const cartItems = getCart(sessionId);

    if (cartItems.length === 0) {
      throw new AppError(400, 'EMPTY_CART', 'Cart is empty. Add items before initiating checkout.');
    }

    // Fetch listing details for all cart items
    const lineItems = await Promise.all(
      cartItems.map(async (item) => {
        const listing = await db.query.listings.findFirst({
          where: and(
            eq(schema.listings.id, item.listingId),
            eq(schema.listings.tenantId, tenantId),
          ),
        });

        if (!listing) {
          throw new AppError(404, 'LISTING_NOT_FOUND', `Listing '${item.listingId}' no longer available`);
        }

        // Get product title
        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, listing.productId),
        });

        const unitPrice = parseFloat(listing.price);
        const lineTotal = unitPrice * item.quantity;

        return {
          listingId: item.listingId,
          title: product?.title || 'Unknown Product',
          sku: listing.sku,
          unitPrice: unitPrice.toFixed(2),
          quantity: item.quantity,
          lineTotal: lineTotal.toFixed(2),
        };
      }),
    );

    const subtotal = lineItems.reduce((sum, item) => sum + parseFloat(item.lineTotal), 0);
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const shipping = SHIPPING_FLAT;
    const discount = 0; // Discount applied during pay step if promo attached
    const total = subtotal + tax + shipping - discount;

    return reply.send({
      data: {
        lineItems,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        currency: 'USD',
      },
    });
  });

  /**
   * POST /checkout/pay — Process simulated payment and create order
   *
   * Requirements: 7.5, 7.6, 7.7, 16.2, 36.8
   * - Accepts email, shippingAddress, paymentMethod
   * - Simulated gateway: success for valid cards, failure if last4 = "0000"
   * - On success: decrement inventory, create order + line items, upsert customer, clear cart
   * - On failure: return error with reason
   */
  fastify.post('/pay', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const sessionId = getSessionId(request);
    const body = validateBody(paySchema, request);

    const cartItems = getCart(sessionId);

    if (cartItems.length === 0) {
      throw new AppError(400, 'EMPTY_CART', 'Cart is empty. Add items before processing payment.');
    }

    // Simulate payment gateway
    if (body.paymentMethod.last4 === '0000') {
      return reply.status(402).send({
        error: {
          code: 'PAYMENT_DECLINED',
          message: 'Card declined',
          nextSteps: 'Please use a different payment method or contact your bank.',
        },
      });
    }

    // Fetch listing details and calculate totals
    const lineItemsData = await Promise.all(
      cartItems.map(async (item) => {
        const listing = await db.query.listings.findFirst({
          where: and(
            eq(schema.listings.id, item.listingId),
            eq(schema.listings.tenantId, tenantId),
          ),
        });

        if (!listing) {
          throw new AppError(404, 'LISTING_NOT_FOUND', `Listing '${item.listingId}' no longer available`);
        }

        const product = await db.query.products.findFirst({
          where: eq(schema.products.id, listing.productId),
        });

        return {
          listingId: item.listingId,
          title: product?.title || 'Unknown Product',
          sku: listing.sku,
          unitPrice: parseFloat(listing.price),
          quantity: item.quantity,
          inventoryQuantity: listing.inventoryQuantity,
        };
      }),
    );

    const subtotal = lineItemsData.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const shipping = SHIPPING_FLAT;
    const discount = 0;
    const total = subtotal + tax + shipping - discount;

    // Decrement inventory atomically for each listing
    for (const item of lineItemsData) {
      await db
        .update(schema.listings)
        .set({
          inventoryQuantity: sql`${schema.listings.inventoryQuantity} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.listings.id, item.listingId),
            eq(schema.listings.tenantId, tenantId),
          ),
        );
    }

    // Create order record
    const [order] = await db
      .insert(schema.orders)
      .values({
        tenantId,
        status: 'confirmed',
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        shipping: shipping.toFixed(2),
        discount: discount.toFixed(2),
        total: total.toFixed(2),
        currency: 'USD',
        shippingAddress: body.shippingAddress,
        billingAddress: body.shippingAddress,
      })
      .returning();

    // Create order line items
    const orderLineItemsValues = lineItemsData.map((item) => ({
      tenantId,
      orderId: order.id,
      listingId: item.listingId,
      title: item.title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
    }));

    await db.insert(schema.orderLineItems).values(orderLineItemsValues);

    // Update CRM - upsert customer from order
    try {
      await upsertCustomerFromOrder(tenantId, body.email, total);
    } catch {
      // CRM update is non-critical, log but don't fail the order
    }

    // Clear cart and release reservations
    clearCart(sessionId);

    return reply.status(201).send({
      data: {
        orderId: order.id,
        status: order.status,
        email: body.email,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        discount: order.discount,
        total: order.total,
        currency: order.currency,
        shippingAddress: body.shippingAddress,
        paymentMethod: {
          type: body.paymentMethod.type,
          last4: body.paymentMethod.last4,
          brand: body.paymentMethod.brand,
        },
        createdAt: order.createdAt.toISOString(),
      },
    });
  });

  /**
   * GET /checkout/orders/:id — Get order details for confirmation page
   *
   * Requirements: 7.7
   */
  fastify.get('/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const { id } = validateParams(orderIdParamSchema, request);

    const order = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.id, id),
        eq(schema.orders.tenantId, tenantId),
      ),
    });

    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', `Order '${id}' not found`);
    }

    // Fetch line items for this order
    const lineItems = await db.query.orderLineItems.findMany({
      where: and(
        eq(schema.orderLineItems.orderId, id),
        eq(schema.orderLineItems.tenantId, tenantId),
      ),
    });

    return reply.send({
      data: {
        id: order.id,
        status: order.status,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        discount: order.discount,
        total: order.total,
        currency: order.currency,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        lineItems: lineItems.map((li) => ({
          id: li.id,
          listingId: li.listingId,
          title: li.title,
          sku: li.sku,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          fulfillmentStatus: li.fulfillmentStatus,
        })),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      },
    });
  });
}
