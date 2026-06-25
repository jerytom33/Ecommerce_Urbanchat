'use client';

import React, { useState } from 'react';
import { Button } from '@ecommerce/ui';
import Link from 'next/link';
import { apiPost } from '../lib/api';

interface AddToCartButtonProps {
  listingId: string;
}

export default function AddToCartButton({ listingId }: AddToCartButtonProps): React.ReactElement {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleAddToCart() {
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      await apiPost('/api/v1/storefront/cart/add', { listingId, quantity });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to add to cart');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Quantity selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-text">Qty:</label>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* Add to Cart button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleAddToCart}
        disabled={loading}
      >
        {loading ? (
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
            Adding…
          </span>
        ) : (
          'Add to Cart'
        )}
      </Button>

      {/* Success message */}
      {success && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-4 py-2">
          <span className="text-sm text-green-700 font-medium">✓ Added to cart!</span>
          <Link
            href="/cart"
            className="text-sm text-primary font-medium hover:underline"
          >
            View Cart →
          </Link>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2">
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}
    </div>
  );
}
