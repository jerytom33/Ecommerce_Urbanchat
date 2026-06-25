import React, { Suspense } from 'react';
import { Button, Card, CardContent } from '@ecommerce/ui';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'dc35d0d1-67ad-4fcd-8c03-ff6382ed983d';

/**
 * Storefront homepage with streaming SSR.
 * Above-the-fold content (hero) renders immediately as a Server Component.
 * Below-the-fold sections stream in via Suspense boundaries.
 */
export default function StorefrontPage(): React.ReactElement {
  return (
    <div className="space-y-12">
      {/* Above-the-fold hero - renders immediately for fast LCP */}
      <section className="text-center py-16 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl">
        <h1 className="text-4xl md:text-5xl font-bold text-text mb-4">
          Welcome to the Store
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto mb-8">
          Discover amazing products with fast, seamless shopping experiences.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/products">
            <Button variant="primary" size="lg">Shop Now</Button>
          </Link>
          <Link href="/products">
            <Button variant="outline" size="lg">Browse Categories</Button>
          </Link>
        </div>
      </section>

      {/* Featured products stream in via Suspense */}
      <Suspense fallback={<FeaturedProductsSkeleton />}>
        <FeaturedProducts />
      </Suspense>

      {/* Categories stream in via Suspense */}
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesSection />
      </Suspense>
    </div>
  );
}

/**
 * Featured products section - Server Component that fetches from the API.
 */
async function FeaturedProducts() {
  let products: any[] = [];

  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/products?limit=8&status=active`, {
      headers: { 'x-tenant-id': TENANT_ID },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      products = json.data || [];
    }
  } catch {
    // Fallback to empty on error
  }

  // Fetch media for each product
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
      <section>
        <h2 className="text-2xl font-bold text-text mb-6">Featured Products</h2>
        <p className="text-muted text-center py-8">No products available yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-text mb-6">Featured Products</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {productsWithMedia.map((product) => {
          const imageUrl = product.media?.[0]?.url;
          const price = product.listings?.[0]?.price || '0.00';
          return (
            <Link key={product.id} href={`/products/${product.id}`}>
              <Card padding="none" className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
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
                  <p className="font-medium text-text group-hover:text-primary transition-colors line-clamp-1">
                    {product.title}
                  </p>
                  <p className="text-sm font-semibold text-primary mt-1">${Number(price).toFixed(2)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function FeaturedProductsSkeleton() {
  return (
    <section>
      <div className="h-8 w-48 bg-surface rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden">
            <div className="aspect-square bg-surface animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-surface rounded animate-pulse w-3/4" />
              <div className="h-4 bg-surface rounded animate-pulse w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Categories section - fetches from the API.
 */
async function CategoriesSection() {
  let categories: any[] = [];

  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/categories`, {
      headers: { 'x-tenant-id': TENANT_ID },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      categories = json.categories || [];
    }
  } catch {}

  if (categories.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-text mb-6">Shop by Category</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {categories.map((category) => (
          <Link key={category.id} href={`/products?category=${category.id}`}>
            <Card className="text-center hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
              <CardContent>
                <p className="font-medium text-text text-sm">{category.name}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CategoriesSkeleton() {
  return (
    <section>
      <div className="h-8 w-40 bg-surface rounded animate-pulse mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-surface rounded-lg border border-border animate-pulse" />
        ))}
      </div>
    </section>
  );
}
