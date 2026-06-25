import { Suspense } from 'react';
import { Button, Card, CardContent } from '@ecommerce/ui';

/**
 * Product Detail Page - Displays full product information with streaming SSR.
 * Above-the-fold: product image + title render immediately.
 * Below-the-fold: related products stream in.
 *
 * Requirements: 14.1, 14.3
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-12">
      {/* Above-the-fold: product details render immediately */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Product Image */}
        <div className="aspect-square bg-surface rounded-lg flex items-center justify-center border border-border">
          <span className="text-muted text-sm">Product Image</span>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-text">Product {id}</h1>
            <p className="text-2xl font-semibold text-primary mt-2">$49.99</p>
          </div>

          <p className="text-muted leading-relaxed">
            This is a placeholder product description. In production, this content
            is fetched from the Storefront API and rendered server-side for SEO.
          </p>

          {/* Variant Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">Size</label>
              <div className="flex gap-2">
                {['S', 'M', 'L', 'XL'].map((size) => (
                  <button
                    key={size}
                    className="px-4 py-2 border border-border rounded-md text-sm hover:border-primary hover:text-primary transition-colors"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">Quantity</label>
              <select
                className="px-3 py-2 text-sm border border-border rounded-md bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                defaultValue="1"
                aria-label="Select quantity"
              >
                {[1, 2, 3, 4, 5].map((qty) => (
                  <option key={qty} value={qty}>{qty}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Add to Cart */}
          <div className="flex gap-3">
            <Button variant="primary" size="lg" className="flex-1">
              Add to Cart
            </Button>
            <Button variant="outline" size="lg">
              ♥
            </Button>
          </div>

          {/* Product Meta */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-sm text-muted">SKU: PROD-{id}-001</p>
            <p className="text-sm text-muted">Category: General</p>
            <p className="text-sm text-success font-medium">In Stock</p>
          </div>
        </div>
      </div>

      {/* Related products stream in via Suspense */}
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedProducts />
      </Suspense>
    </div>
  );
}

async function RelatedProducts() {
  const products = Array.from({ length: 4 }, (_, i) => ({
    id: `related-${i + 1}`,
    title: `Related Product ${i + 1}`,
    price: ((i + 1) * 24.99).toFixed(2),
  }));

  return (
    <section>
      <h2 className="text-2xl font-bold text-text mb-6">You May Also Like</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <a key={product.id} href={`/products/${product.id}`} className="group">
            <Card padding="none" className="overflow-hidden transition-shadow group-hover:shadow-md">
              <div className="aspect-square bg-surface flex items-center justify-center">
                <span className="text-muted text-sm">No Image</span>
              </div>
              <CardContent>
                <h3 className="font-medium text-text group-hover:text-primary transition-colors">
                  {product.title}
                </h3>
                <p className="text-sm text-muted mt-1">${product.price}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}

function RelatedProductsSkeleton() {
  return (
    <section>
      <div className="h-8 w-48 bg-surface rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden animate-pulse">
            <div className="aspect-square bg-surface" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-surface rounded w-3/4" />
              <div className="h-4 bg-surface rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
