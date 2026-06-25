import { Suspense } from 'react';
import { Card, CardContent } from '@ecommerce/ui';

/**
 * Product Listing Page - Grid layout with streaming SSR.
 * Above-the-fold: page title and filter controls render immediately.
 * Below-the-fold: product grid streams in via Suspense.
 *
 * Requirements: 14.1, 14.3
 */
export default function ProductsPage() {
  return (
    <div className="space-y-8">
      {/* Above-the-fold: heading + filters render immediately */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-text">All Products</h1>
        <div className="flex items-center gap-3">
          <select
            className="px-3 py-2 text-sm border border-border rounded-md bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Sort products"
            defaultValue="featured"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Product grid streams in via Suspense */}
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid />
      </Suspense>
    </div>
  );
}

/**
 * Product grid - Server Component that fetches and renders product cards.
 * In production, fetches from the Storefront API with pagination.
 */
async function ProductGrid() {
  // Placeholder product data; in production, fetched via GraphQL from Storefront API
  const products = Array.from({ length: 12 }, (_, i) => ({
    id: `prod-${i + 1}`,
    title: `Product ${i + 1}`,
    price: ((i + 1) * 19.99).toFixed(2),
    image: null as string | null,
  }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((product) => (
        <a key={product.id} href={`/products/${product.id}`} className="group">
          <Card padding="none" className="overflow-hidden transition-shadow group-hover:shadow-md">
            <div className="aspect-square bg-surface flex items-center justify-center">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              ) : (
                <span className="text-muted text-sm">No Image</span>
              )}
            </div>
            <CardContent>
              <h3 className="font-medium text-text group-hover:text-primary transition-colors line-clamp-2">
                {product.title}
              </h3>
              <p className="text-sm text-muted mt-1">${product.price}</p>
            </CardContent>
          </Card>
        </a>
      ))}
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
            <div className="h-4 bg-surface rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
