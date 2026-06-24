import { Suspense } from 'react';
import { Button, Card, CardContent } from '@ecommerce/ui';

/**
 * Storefront homepage with streaming SSR.
 * Above-the-fold content (hero) renders immediately as a Server Component.
 * Below-the-fold sections stream in via Suspense boundaries.
 */
export default function StorefrontPage() {
  return (
    <div className="space-y-12">
      {/* Above-the-fold hero - renders immediately for fast LCP */}
      <section className="text-center py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-text mb-4">
          Welcome to the Store
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto mb-8">
          Discover amazing products with fast, seamless shopping experiences.
        </p>
        <div className="flex gap-4 justify-center">
          <Button variant="primary" size="lg">Shop Now</Button>
          <Button variant="outline" size="lg">Browse Categories</Button>
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
 * Featured products section - Server Component that can stream.
 * In production, this fetches from the API with proper caching.
 */
async function FeaturedProducts() {
  return (
    <section>
      <h2 className="text-2xl font-bold text-text mb-6">Featured Products</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} padding="none" className="overflow-hidden">
            <div className="aspect-square bg-surface" />
            <CardContent>
              <p className="font-medium text-text">Product {i + 1}</p>
              <p className="text-sm text-muted mt-1">$0.00</p>
            </CardContent>
          </Card>
        ))}
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

async function CategoriesSection() {
  return (
    <section>
      <h2 className="text-2xl font-bold text-text mb-6">Shop by Category</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {['Electronics', 'Clothing', 'Home', 'Books', 'Sports', 'Beauty'].map(
          (category) => (
            <Card key={category} className="text-center hover:shadow-md transition-shadow cursor-pointer">
              <CardContent>
                <p className="font-medium text-text text-sm">{category}</p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </section>
  );
}

function CategoriesSkeleton() {
  return (
    <section>
      <div className="h-8 w-40 bg-surface rounded animate-pulse mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-surface rounded-lg border border-border animate-pulse" />
        ))}
      </div>
    </section>
  );
}
