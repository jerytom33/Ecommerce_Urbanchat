'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent } from '@ecommerce/ui';
import Link from 'next/link';
import { apiGet, apiPut, apiDelete } from '../../lib/api';

interface CartItem {
  listingId: string;
  quantity: number;
  listing: {
    id: string;
    sku: string;
    price: string | number;
    product?: {
      title?: string;
    };
  };
}

export default function CartPage(): React.ReactElement {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function fetchCart() {
    try {
      const json = await apiGet('/api/v1/storefront/cart');
      setItems(json.data?.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCart();
  }, []);

  async function updateQuantity(listingId: string, quantity: number) {
    setUpdating(listingId);
    try {
      if (quantity <= 0) {
        await apiDelete(`/api/v1/storefront/cart/items/${listingId}`);
      } else {
        await apiPut(`/api/v1/storefront/cart/items/${listingId}`, { quantity });
      }
      await fetchCart();
    } catch (err: any) {
      setError(err.message || 'Failed to update cart');
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(listingId: string) {
    setUpdating(listingId);
    try {
      await apiDelete(`/api/v1/storefront/cart/items/${listingId}`);
      await fetchCart();
    } catch (err: any) {
      setError(err.message || 'Failed to remove item');
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted mt-4">Loading cart…</p>
      </div>
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.listing.price) * item.quantity,
    0
  );
  const shipping = 5.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-text">Shopping Cart</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2">
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg text-muted mb-4">Your cart is empty</p>
          <Link href="/products">
            <Button variant="primary">Continue Shopping</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const price = Number(item.listing.price);
              const title =
                item.listing.product?.title || item.listing.sku || 'Product';
              const isUpdating = updating === item.listingId;

              return (
                <Card key={item.listingId} className="flex gap-4 items-center">
                  <CardContent className="flex flex-1 items-center gap-4">
                    {/* Placeholder image */}
                    <div className="w-20 h-20 bg-surface rounded-md flex-shrink-0 flex items-center justify-center border border-border">
                      <span className="text-muted text-xs">Img</span>
                    </div>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text truncate">{title}</h3>
                      <p className="text-sm text-muted">SKU: {item.listing.sku}</p>
                      <p className="text-sm font-medium text-primary">
                        ${price.toFixed(2)}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.listingId, item.quantity - 1)
                        }
                        disabled={isUpdating}
                        className="w-8 h-8 flex items-center justify-center border border-border rounded-md text-sm hover:bg-surface transition-colors disabled:opacity-50"
                        aria-label={`Decrease quantity of ${title}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.listingId, item.quantity + 1)
                        }
                        disabled={isUpdating}
                        className="w-8 h-8 flex items-center justify-center border border-border rounded-md text-sm hover:bg-surface transition-colors disabled:opacity-50"
                        aria-label={`Increase quantity of ${title}`}
                      >
                        +
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeItem(item.listingId)}
                      disabled={isUpdating}
                      className="text-muted hover:text-error transition-colors text-sm disabled:opacity-50"
                      aria-label={`Remove ${title} from cart`}
                    >
                      ✕
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Order Summary */}
          <div>
            <Card>
              <CardContent className="space-y-4">
                <h2 className="text-lg font-bold text-text">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Subtotal</span>
                    <span className="text-text">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Shipping</span>
                    <span className="text-text">${shipping.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Tax (8%)</span>
                    <span className="text-text">${tax.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-bold">
                    <span className="text-text">Total</span>
                    <span className="text-text">${total.toFixed(2)}</span>
                  </div>
                </div>
                <Link href="/checkout">
                  <Button variant="primary" size="lg" className="w-full">
                    Proceed to Checkout
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
