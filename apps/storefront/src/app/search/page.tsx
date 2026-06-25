import React, { Suspense } from 'react';
import { Input, Button, Card, CardContent } from '@ecommerce/ui';

/**
 * Search Results Page - Displays search input and results with streaming SSR.
 * Above-the-fold: search input renders immediately.
 * Below-the-fold: search results stream in via Suspense.
 *
 * Requirements: 14.1, 14.3
 */
export default function SearchPage(): React.ReactElement {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Above-the-fold: search input renders immediately */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-text">Search Products</h1>
        <form className="flex gap-3" action="/search" method="GET">
          <div className="flex-1">
            <Input
              placeholder="Search for products..."
              name="q"
              aria-label="Search products"
            />
          </div>
          <Button variant="primary" type="submit">
            Search
          </Button>
        </form>
      </div>

      {/* Search results stream in via Suspense */}
      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchResults />
      </Suspense>
    </div>
  );
}

/**
 * Search results - Server Component that streams in.
 * In production, queries OpenSearch/Elasticsearch via the Storefront API.
 */
async function SearchResults() {
  // Placeholder results; in production, fetched from search service
  const results = Array.from({ length: 6 }, (_, i) => ({
    id: `search-result-${i + 1}`,
    title: `Search Result ${i + 1}`,
    description: 'A matching product for your search query.',
    price: ((i + 1) * 15.99).toFixed(2),
  }));

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">{results.length} results found</p>
      </div>
      <div className="space-y-4">
        {results.map((result) => (
          <a key={result.id} href={`/products/${result.id}`} className="block group">
            <Card className="transition-shadow group-hover:shadow-md">
              <CardContent className="flex gap-4 items-center">
                {/* Thumbnail */}
                <div className="w-16 h-16 bg-surface rounded-md flex-shrink-0 flex items-center justify-center border border-border">
                  <span className="text-muted text-xs">Img</span>
                </div>

                {/* Result Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-text group-hover:text-primary transition-colors">
                    {result.title}
                  </h3>
                  <p className="text-sm text-muted line-clamp-1">{result.description}</p>
                </div>

                {/* Price */}
                <span className="text-sm font-medium text-primary flex-shrink-0">
                  ${result.price}
                </span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}

function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 bg-surface rounded animate-pulse" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4 flex gap-4 items-center animate-pulse">
          <div className="w-16 h-16 bg-surface rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-surface rounded w-1/2" />
            <div className="h-3 bg-surface rounded w-3/4" />
          </div>
          <div className="h-4 w-16 bg-surface rounded" />
        </div>
      ))}
    </div>
  );
}
