import React, { Suspense } from 'react';
import { Card, CardContent } from '@ecommerce/ui';
import Link from 'next/link';
import AddToCartButton from '../../../components/AddToCartButton';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'dc35d0d1-67ad-4fcd-8c03-ff6382ed983d';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;

  let product: any = null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/products/${id}`, {
      headers: { 'x-tenant-id': TENANT_ID },
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const json = await res.json();
      product = json.data;
    }
  } catch {}

  if (!product) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-text">Product Not Found</h1>
        <Link href="/products" className="text-primary hover:underline mt-4 inline-block">
          ← Back to Products
        </Link>
      </div>
    );
  }

  const imageUrl = product.media?.[0]?.url;
  const listings = product.listings || [];
  const mainListing = listings[0];
  const price = mainListing?.price ? Number(mainListing.price).toFixed(2) : '0.00';

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {/* Product Image */}
        <div className="aspect-square bg-surface rounded-lg overflow-hidden border border-border">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              No Image
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-text">{product.title}</h1>
            <p className="text-2xl font-semibold text-primary mt-2">${price}</p>
          </div>

          {product.description && (
            <p className="text-muted leading-relaxed">{product.description}</p>
          )}

          {/* Variants */}
          {listings.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">Options</label>
              <div className="flex flex-wrap gap-2">
                {listings.map((listing: any) => (
                  <span
                    key={listing.id}
                    className="px-3 py-1.5 border border-border rounded-md text-sm text-text hover:border-primary cursor-pointer"
                  >
                    {listing.sku} — ${Number(listing.price).toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stock Status */}
          <div>
            {mainListing?.inventoryQuantity > 0 ? (
              <p className="text-sm text-success font-medium">
                ✓ In Stock ({mainListing.inventoryQuantity} available)
              </p>
            ) : (
              <p className="text-sm text-error font-medium">Out of Stock</p>
            )}
          </div>

          {/* Add to Cart */}
          {mainListing && (
            <AddToCartButton listingId={mainListing.id} />
          )}

          {/* Meta */}
          <div className="border-t border-border pt-4 space-y-1 text-sm text-muted">
            {mainListing?.sku && <p>SKU: {mainListing.sku}</p>}
            <p>Status: {product.status}</p>
          </div>
        </div>
      </div>

      {/* Related products */}
      <Suspense fallback={null}>
        <RelatedProducts currentId={id} />
      </Suspense>
    </div>
  );
}

async function RelatedProducts({ currentId }: { currentId: string }) {
  let products: any[] = [];
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/products?limit=4&status=active`, {
      headers: { 'x-tenant-id': TENANT_ID },
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = await res.json();
      products = (json.data || []).filter((p: any) => p.id !== currentId).slice(0, 4);
    }
  } catch {}

  if (products.length === 0) return null;

  return (
    <section>
      <h2 className="text-2xl font-bold text-text mb-6">You May Also Like</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {products.map((p) => (
          <Link key={p.id} href={`/products/${p.id}`} className="group">
            <Card padding="none" className="overflow-hidden group-hover:shadow-md transition-shadow">
              <div className="aspect-square bg-surface" />
              <CardContent>
                <p className="font-medium text-text group-hover:text-primary transition-colors line-clamp-1">
                  {p.title}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
