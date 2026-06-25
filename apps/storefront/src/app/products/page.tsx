import React, { Suspense } from 'react';
import { Card, CardContent } from '@ecommerce/ui';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'dc35d0d1-67ad-4fcd-8c03-ff6382ed983d';

/**
 * Product Listing Page - Grid layout with streaming SSR.
 * Fetches real products from the API with Unsplash images.
 */
export default function ProductsPage(): React.ReactElement {
  return (
    <div className="space-y-8">
      {/* Above-the-fold: heading renders immediately */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-text">All Products</h1>
      </div>

      {/* Product grid streams in via Suspense */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />
      </Suspense>
    </div>
  );
}

/**
 * Product grid - Server Component that fetches real products from the API.
 */
async function ProductGrid() {
  let products: any[] = [];

  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/products?limit=20&status=active`, {
      headers: { 'x-tenant-id': TENANT_ID },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      products = json.data || [];
    }
  } catch {}

  // Fetch full details (with media) for each product
  const productsWithMedia = await Promise.all(
    products.map(async (product) => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/admin/products/${product.id}`, {
          headers: { 'x-tenant-id': TENANT_ID },
          next: { revalidate: 60 },
        });
        if (res.ok) {
          const json = await res.json();
          return json.data;
        }
      } catch {}
      return { ...product, media: [], listings: [] };
    })
  );

  if (productsWithMedia.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg text-muted">No products found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {productsWithMedia.map((product) => {
        const imageUrl = product.media?.[0]?.url;
        const price = product.listings?.[0]?.price || '0.00';
        return (
          <Link key={product.id} href={`/products/${product.id}`} className="group">
            <Card padding="none" className="overflow-hidden transition-shadow group-hover:shadow-lg">
              <div className="aspect-square bg-surface relative overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    No Image
                  </div>
                )}
              </div>
              <CardContent>
                <h3 className="font-medium text-text group-hover:text-primary transition-colors line-clamp-2">
                  {product.title}
                </h3>
                <p className="text-sm text-muted mt-1 line-clamp-1">{product.description}</p>
                <p className="text-sm font-semibold text-primary mt-2">${Number(price).toFixed(2)}</p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden animate-pulse">
          <div className="aspect-square bg-surface" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-surface rounded w-3/4" />
            <div className="h-3 bg-surface rounded w-full" />
            <div className="h-4 bg-surface rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
