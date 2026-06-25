'use client';

import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, Input } from '@ecommerce/ui';
import Link from 'next/link';
import { apiGet, apiPost } from '../../lib/api';

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

export default function CheckoutPage(): React.ReactElement {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);

  // Form fields
  const [email, setEmail] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('US');
  const [last4, setLast4] = useState('');

  // State
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    async function loadCart() {
      try {
        const json = await apiGet('/api/v1/storefront/cart');
        setItems(json.data?.items || []);
      } catch {
        // Cart may be empty
      } finally {
        setCartLoading(false);
      }
    }
    loadCart();
  }, []);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.listing.price) * item.quantity,
    0
  );
  const shipping = 5.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  const isFormValid =
    email.trim() !== '' &&
    line1.trim() !== '' &&
    city.trim() !== '' &&
    state.trim() !== '' &&
    zip.trim() !== '' &&
    country.trim() !== '' &&
    last4.trim().length === 4;

  async function handlePlaceOrder() {
    setProcessing(true);
    setError('');
    try {
      const res = await apiPost('/api/v1/storefront/checkout/pay', {
        email,
        shippingAddress: { line1, city, state, zip, country },
        paymentMethod: { type: 'card', last4, brand: 'Visa' },
      });
      setOrderId(res.data?.id || res.data?.orderId || 'confirmed');
    } catch (err: any) {
      const msg = err.message || 'Payment failed';
      if (msg.toLowerCase().includes('declined') || last4 === '0000') {
        setError('Card declined. Please try a different payment method.');
      } else {
        setError(msg);
      }
    } finally {
      setProcessing(false);
    }
  }

  // Order confirmation
  if (orderId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-3xl font-bold text-text">Order Confirmed!</h1>
        <p className="text-muted">
          Your order has been placed successfully.
        </p>
        <p className="text-sm text-muted">
          Order ID: <span className="font-mono font-medium text-text">{orderId}</span>
        </p>
        <Link href="/products">
          <Button variant="primary">Continue Shopping</Button>
        </Link>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted mt-4">Loading checkout…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-text">Checkout</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
          <span className="text-sm text-red-700 font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Contact Information</h2>
              <Input
                label="Email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Shipping Address</h2>
              <Input
                label="Address"
                placeholder="123 Main St"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="City"
                  placeholder="New York"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label="State"
                  placeholder="NY"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  label="ZIP Code"
                  placeholder="10001"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
              <Input
                label="Country"
                placeholder="US"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Payment</h2>
              <p className="text-sm text-muted">
                Enter the last 4 digits of your card for demo purposes.
              </p>
              <Input
                label="Last 4 digits"
                placeholder="4242"
                maxLength={4}
                value={last4}
                onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <p className="text-xs text-muted">
                Use &quot;0000&quot; to simulate a declined card.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardContent className="space-y-4">
              <h2 className="text-lg font-bold text-text">Order Summary</h2>

              {/* Order Items */}
              <div className="space-y-3">
                {items.map((item) => {
                  const price = Number(item.listing.price);
                  const title =
                    item.listing.product?.title || item.listing.sku || 'Product';
                  return (
                    <div key={item.listingId} className="flex justify-between text-sm">
                      <span className="text-text">
                        {title} × {item.quantity}
                      </span>
                      <span className="text-text">
                        ${(price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3 space-y-2 text-sm">
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

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handlePlaceOrder}
                disabled={!isFormValid || processing}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Processing…
                  </span>
                ) : (
                  'Place Order'
                )}
              </Button>

              <p className="text-xs text-muted text-center">
                By placing your order, you agree to our Terms of Service and Privacy Policy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
