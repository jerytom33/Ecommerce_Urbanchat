import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db, schema, eq, and, sql } from '@ecommerce/database';
import { validateBody } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const applyCouponSchema = z.object({
  code: z.string()
    .min(3, 'Coupon code must be at least 3 characters')
    .max(32, 'Coupon code must be at most 32 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Coupon code must be alphanumeric only'),
  cartTotal: z.number().min(0).optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface PromotionConditions {
  minCartValue?: number;
  specificProducts?: string[];
  specificCategories?: string[];
  customerSegments?: string[];
}

interface StackingRules {
  mode?: 'best_only' | 'combinable';
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getTenantId(request: FastifyRequest): string {
  const jwtTenantId = (request as any).tenantId;
  if (jwtTenantId) return jwtTenantId;

  const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) return headerTenantId;

  throw new AppError(401, 'UNAUTHORIZED', 'Missing tenant context. Provide x-tenant-id header or authenticate.');
}

/**
 * Calculates the discount amount based on promotion type and cart total.
 * Ensures the final price never goes negative (caps discount at cartTotal).
 */
export function calculateDiscountAmount(
  type: string,
  value: number,
  cartTotal: number,
): number {
  let amount: number;

  switch (type) {
    case 'percentage':
      // value is 1-100, representing a percentage
      amount = (cartTotal * value) / 100;
      break;
    case 'fixed_amount':
      amount = value;
      break;
    case 'free_shipping':
      // Free shipping doesn't reduce cart total directly; amount is 0
      // The shipping cost removal is handled at checkout
      amount = 0;
      break;
    case 'buy_x_get_y':
      // Buy-X-Get-Y discount is context-dependent on items in cart
      // For now, return value as the discount amount (cheapest qualifying item)
      amount = value;
      break;
    default:
      amount = 0;
  }

  // Ensure final price never goes negative: cap discount at cart total
  if (amount > cartTotal) {
    amount = cartTotal;
  }

  // Round to 2 decimal places
  return Math.round(amount * 100) / 100;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function storefrontPromotionRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /cart/apply-coupon — Validate and apply a coupon code
   *
   * Validates coupon code format (case-insensitive, 3-32 alphanumeric).
   * Finds promotion by code (case-insensitive match).
   * Checks: is_active, within date range, not exceeded max_redemptions.
   * Checks: min cart value met (if condition exists).
   * Calculates discount amount based on type.
   * Returns: { discount: { type, value, amount, code } }
   * Returns 400 with specific reason if invalid/expired/exceeded.
   *
   * Requirements: 23.2, 23.3, 23.5, 23.6, 23.7
   */
  fastify.post('/cart/apply-coupon', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = getTenantId(request);
    const body = validateBody(applyCouponSchema, request);

    // Normalize code to uppercase for case-insensitive matching
    const normalizedCode = body.code.toUpperCase();

    // Find promotion by code (case-insensitive, stored as uppercase)
    const promotion = await db.query.promotions.findFirst({
      where: and(
        eq(schema.promotions.tenantId, tenantId),
        eq(schema.promotions.code, normalizedCode),
      ),
    });

    if (!promotion) {
      throw new AppError(400, 'COUPON_NOT_FOUND', `Coupon code '${body.code}' is not valid`);
    }

    // Check if promotion is active
    if (!promotion.active) {
      throw new AppError(400, 'COUPON_INACTIVE', 'This coupon is no longer active');
    }

    // Check if promotion has started
    const now = new Date();
    if (promotion.startsAt && new Date(promotion.startsAt) > now) {
      throw new AppError(400, 'COUPON_NOT_STARTED', 'This coupon is not yet active');
    }

    // Check if promotion has expired
    if (promotion.endsAt && new Date(promotion.endsAt) < now) {
      throw new AppError(400, 'COUPON_EXPIRED', 'This coupon has expired');
    }

    // Check if promotion has reached max redemptions
    if (promotion.maxRedemptions !== null && promotion.currentRedemptions >= promotion.maxRedemptions) {
      throw new AppError(400, 'COUPON_MAX_REDEMPTIONS', 'This coupon has reached its maximum number of uses');
    }

    // Parse conditions and stacking rules
    const conditions = (promotion.conditions || {}) as PromotionConditions;
    const stackingRules = (promotion.stackingRules || { mode: 'best_only' }) as StackingRules;

    // Check min cart value condition
    const cartTotal = body.cartTotal ?? 0;
    if (conditions.minCartValue !== undefined && conditions.minCartValue > 0 && cartTotal < conditions.minCartValue) {
      throw new AppError(
        400,
        'CART_MINIMUM_NOT_MET',
        `Cart total must be at least ${conditions.minCartValue} to use this coupon`,
      );
    }

    // Check specific products condition
    if (conditions.specificProducts && conditions.specificProducts.length > 0) {
      const cartProductIds = body.productIds ?? [];
      const hasMatchingProduct = conditions.specificProducts.some(
        (pid) => cartProductIds.includes(pid),
      );
      if (!hasMatchingProduct) {
        throw new AppError(
          400,
          'PRODUCTS_NOT_ELIGIBLE',
          'Your cart does not contain products eligible for this coupon',
        );
      }
    }

    // Calculate discount amount
    const promotionValue = Number(promotion.value);
    const discountAmount = calculateDiscountAmount(promotion.type, promotionValue, cartTotal);

    // Build response
    const discount = {
      type: promotion.type,
      value: promotionValue,
      amount: discountAmount,
      code: promotion.code,
      stackingRule: stackingRules.mode || 'best_only',
    };

    return reply.send({
      discount,
      message: 'Coupon applied successfully',
    });
  });
}
