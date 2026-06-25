import React from 'react';

/**
 * Root loading state for the storefront.
 * This shows during route transitions while streaming SSR data loads.
 */
export default function Loading(): React.ReactElement {
  return (
    <div className="space-y-12 animate-pulse">
      {/* Hero skeleton */}
      <div className="text-center py-16">
        <div className="h-12 w-96 mx-auto bg-surface rounded mb-4" />
        <div className="h-6 w-64 mx-auto bg-surface rounded mb-8" />
        <div className="flex gap-4 justify-center">
          <div className="h-12 w-32 bg-surface rounded-lg" />
          <div className="h-12 w-40 bg-surface rounded-lg" />
        </div>
      </div>

      {/* Product grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden">
            <div className="aspect-square bg-surface" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-surface rounded w-3/4" />
              <div className="h-4 bg-surface rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
