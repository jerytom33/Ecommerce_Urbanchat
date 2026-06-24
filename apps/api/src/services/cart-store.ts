/**
 * In-memory cart store with inventory reservation support.
 * Prototype implementation using Maps — production would use Redis.
 *
 * Requirements: 7.1, 7.2
 * - Reserve stock for 15 minutes
 * - Max 50 distinct line items per cart
 * - Max 100 units per line item
 * - Release expired reservations automatically
 */

export interface CartItem {
  listingId: string;
  quantity: number;
  reservedAt: number; // Unix timestamp (ms)
}

export interface CartData {
  items: Map<string, CartItem>; // keyed by listingId
}

const RESERVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LINE_ITEMS = 50;
const MAX_QUANTITY_PER_ITEM = 100;

/** Session-keyed cart storage */
const carts = new Map<string, CartData>();

/** Listing-level total reserved quantity across all carts */
const reservedStock = new Map<string, number>();

/** Cleanup interval reference */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the automatic reservation cleanup loop.
 * Called once on service initialization.
 */
export function startReservationCleanup(intervalMs = 60_000): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    releaseExpiredReservations();
  }, intervalMs);
  // Don't prevent Node.js from exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Stops the cleanup interval (for testing teardown).
 */
export function stopReservationCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Scans all carts and releases items whose reservation has expired.
 */
export function releaseExpiredReservations(): void {
  const now = Date.now();
  for (const [sessionId, cart] of carts.entries()) {
    for (const [listingId, item] of cart.items.entries()) {
      if (now - item.reservedAt >= RESERVATION_TTL_MS) {
        // Release the reserved stock
        const currentReserved = reservedStock.get(listingId) || 0;
        reservedStock.set(listingId, Math.max(0, currentReserved - item.quantity));
        cart.items.delete(listingId);
      }
    }
    // Remove empty carts
    if (cart.items.size === 0) {
      carts.delete(sessionId);
    }
  }
}

/**
 * Gets the cart for a given session. Returns null if no cart exists.
 */
export function getCart(sessionId: string): CartItem[] {
  const cart = carts.get(sessionId);
  if (!cart) return [];

  // Filter out expired items on read
  const now = Date.now();
  const validItems: CartItem[] = [];
  for (const [listingId, item] of cart.items.entries()) {
    if (now - item.reservedAt >= RESERVATION_TTL_MS) {
      // Release expired reservation
      const currentReserved = reservedStock.get(listingId) || 0;
      reservedStock.set(listingId, Math.max(0, currentReserved - item.quantity));
      cart.items.delete(listingId);
    } else {
      validItems.push(item);
    }
  }

  if (cart.items.size === 0) {
    carts.delete(sessionId);
  }

  return validItems;
}

export interface AddToCartResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Adds an item to the cart with inventory reservation.
 *
 * @param sessionId - The session identifier
 * @param listingId - The listing to add
 * @param quantity - Quantity to add
 * @param availableStock - The current available inventory for this listing
 * @returns Result indicating success or a specific error
 */
export function addToCart(
  sessionId: string,
  listingId: string,
  quantity: number,
  availableStock: number,
): AddToCartResult {
  // Validate quantity bounds
  if (quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
    return {
      success: false,
      error: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`,
      errorCode: 'INVALID_QUANTITY',
    };
  }

  // Get or create cart
  let cart = carts.get(sessionId);
  if (!cart) {
    cart = { items: new Map() };
    carts.set(sessionId, cart);
  }

  // Clean expired items from this cart first
  const now = Date.now();
  for (const [lid, item] of cart.items.entries()) {
    if (now - item.reservedAt >= RESERVATION_TTL_MS) {
      const currentReserved = reservedStock.get(lid) || 0;
      reservedStock.set(lid, Math.max(0, currentReserved - item.quantity));
      cart.items.delete(lid);
    }
  }

  // Check max line items (only if this is a new item)
  const existingItem = cart.items.get(listingId);
  if (!existingItem && cart.items.size >= MAX_LINE_ITEMS) {
    return {
      success: false,
      error: `Cart cannot exceed ${MAX_LINE_ITEMS} distinct line items`,
      errorCode: 'MAX_LINE_ITEMS_EXCEEDED',
    };
  }

  // Calculate total quantity for this item after addition
  const currentQuantity = existingItem ? existingItem.quantity : 0;
  const newQuantity = currentQuantity + quantity;

  if (newQuantity > MAX_QUANTITY_PER_ITEM) {
    return {
      success: false,
      error: `Cannot exceed ${MAX_QUANTITY_PER_ITEM} units per line item. Currently ${currentQuantity} in cart.`,
      errorCode: 'MAX_QUANTITY_EXCEEDED',
    };
  }

  // Check available stock (considering reservations from other sessions)
  const totalReservedForListing = reservedStock.get(listingId) || 0;
  const reservedByThisSession = currentQuantity;
  const reservedByOthers = totalReservedForListing - reservedByThisSession;
  const effectiveAvailable = availableStock - reservedByOthers;

  if (newQuantity > effectiveAvailable) {
    return {
      success: false,
      error: `Insufficient stock. Only ${Math.max(0, effectiveAvailable - currentQuantity)} additional units available.`,
      errorCode: 'INSUFFICIENT_STOCK',
    };
  }

  // Reserve the stock
  if (existingItem) {
    // Update existing reservation
    const oldQty = existingItem.quantity;
    existingItem.quantity = newQuantity;
    existingItem.reservedAt = now; // Reset reservation timer
    // Update global reserved count
    reservedStock.set(listingId, (reservedStock.get(listingId) || 0) + quantity);
  } else {
    // New item
    cart.items.set(listingId, {
      listingId,
      quantity: newQuantity,
      reservedAt: now,
    });
    reservedStock.set(listingId, (reservedStock.get(listingId) || 0) + newQuantity);
  }

  return { success: true };
}

/**
 * Removes a specific item from the cart, releasing its reservation.
 */
export function removeFromCart(sessionId: string, listingId: string): boolean {
  const cart = carts.get(sessionId);
  if (!cart) return false;

  const item = cart.items.get(listingId);
  if (!item) return false;

  // Release reserved stock
  const currentReserved = reservedStock.get(listingId) || 0;
  reservedStock.set(listingId, Math.max(0, currentReserved - item.quantity));
  cart.items.delete(listingId);

  // Remove empty carts
  if (cart.items.size === 0) {
    carts.delete(sessionId);
  }

  return true;
}

/**
 * Clears all items from a cart, releasing all reservations.
 */
export function clearCart(sessionId: string): boolean {
  const cart = carts.get(sessionId);
  if (!cart) return false;

  for (const [listingId, item] of cart.items.entries()) {
    const currentReserved = reservedStock.get(listingId) || 0;
    reservedStock.set(listingId, Math.max(0, currentReserved - item.quantity));
  }

  carts.delete(sessionId);
  return true;
}

/**
 * Gets the total reserved quantity for a listing across all sessions.
 */
export function getReservedStock(listingId: string): number {
  return reservedStock.get(listingId) || 0;
}

/**
 * Updates the quantity of an existing cart item with stock validation.
 *
 * @param sessionId - The session identifier
 * @param listingId - The listing to update
 * @param newQuantity - The new desired quantity (replaces, not adds)
 * @param availableStock - The current available inventory for this listing
 * @returns Result indicating success or a specific error
 */
export function updateItemQuantity(
  sessionId: string,
  listingId: string,
  newQuantity: number,
  availableStock: number,
): AddToCartResult {
  // Validate quantity bounds
  if (newQuantity < 1 || newQuantity > MAX_QUANTITY_PER_ITEM) {
    return {
      success: false,
      error: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`,
      errorCode: 'INVALID_QUANTITY',
    };
  }

  const cart = carts.get(sessionId);
  if (!cart) {
    return {
      success: false,
      error: `Item with listingId '${listingId}' not found in cart`,
      errorCode: 'ITEM_NOT_FOUND',
    };
  }

  const existingItem = cart.items.get(listingId);
  if (!existingItem) {
    return {
      success: false,
      error: `Item with listingId '${listingId}' not found in cart`,
      errorCode: 'ITEM_NOT_FOUND',
    };
  }

  // Check available stock (considering reservations from other sessions)
  const totalReservedForListing = reservedStock.get(listingId) || 0;
  const reservedByThisSession = existingItem.quantity;
  const reservedByOthers = totalReservedForListing - reservedByThisSession;
  const effectiveAvailable = availableStock - reservedByOthers;

  if (newQuantity > effectiveAvailable) {
    return {
      success: false,
      error: `Insufficient stock. Only ${Math.max(0, effectiveAvailable)} units available.`,
      errorCode: 'INSUFFICIENT_STOCK',
    };
  }

  // Update the reservation
  const oldQty = existingItem.quantity;
  existingItem.quantity = newQuantity;
  existingItem.reservedAt = Date.now(); // Reset reservation timer

  // Update global reserved count
  const currentReserved = reservedStock.get(listingId) || 0;
  reservedStock.set(listingId, currentReserved - oldQty + newQuantity);

  return { success: true };
}

/**
 * Gets cart metadata (for debugging/testing).
 */
export function getCartCount(): number {
  return carts.size;
}

/**
 * Resets all cart state (for testing).
 */
export function resetCartStore(): void {
  carts.clear();
  reservedStock.clear();
}

export { RESERVATION_TTL_MS, MAX_LINE_ITEMS, MAX_QUANTITY_PER_ITEM };
