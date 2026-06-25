'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Badge, Table, Input } from '@ecommerce/ui';
import type { TableColumn } from '@ecommerce/ui';
import { apiFetch } from '../../lib/api';
import type { PaginatedResponse } from '../../lib/api';

interface Product {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'archived';
  category?: { id: string; name: string } | null;
  listingsCount: number;
  createdAt: string;
}

type StatusFilter = 'all' | 'draft' | 'active' | 'archived';

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'success' | 'error' | 'primary'> = {
  draft: 'default',
  active: 'success',
  archived: 'error',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [prevCursor, setPrevCursor] = useState<string | undefined>();
  const [currentCursor, setCurrentCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (cursor) params.set('cursor', cursor);
      params.set('limit', '20');

      const result = await apiFetch<PaginatedResponse<Product>>(
        `/products?${params.toString()}`
      );
      setProducts(result.data);
      setNextCursor(result.pagination.nextCursor);
      setPrevCursor(result.pagination.prevCursor);
      setHasMore(result.pagination.hasMore);
      setTotal(result.pagination.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to load products';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentCursor(undefined);
    fetchProducts();
  };

  const handleNextPage = () => {
    if (nextCursor) {
      setCurrentCursor(nextCursor);
      fetchProducts(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (prevCursor) {
      setCurrentCursor(prevCursor);
      fetchProducts(prevCursor);
    }
  };

  const columns: TableColumn<Product>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (product) => (
        <Link
          href={`/products/${product.id}`}
          className="text-primary hover:underline font-medium"
        >
          {product.title}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (product) => (
        <Badge variant={STATUS_BADGE_VARIANT[product.status] || 'default'}>
          {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (product) => (
        <span className="text-muted">{product.category?.name || '—'}</span>
      ),
    },
    {
      key: 'listingsCount',
      header: 'Listings',
      render: (product) => <span>{product.listingsCount}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (product) => (
        <span className="text-muted">
          {new Date(product.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const statusTabs: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Products</h1>
          <p className="text-muted mt-1">
            Manage your product catalog{total > 0 && ` (${total} total)`}
          </p>
        </div>
        <Link href="/products/create">
          <Button>Create Product</Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <Input
            placeholder="Search products by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        {/* Status Tabs */}
        <div className="flex gap-1 border-b border-border">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentCursor(undefined);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                statusFilter === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-text hover:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/20 rounded-md p-4">
          <p className="text-sm text-error">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => fetchProducts(currentCursor)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Products Table */}
      {!loading && !error && (
        <>
          <Table<Product>
            columns={columns}
            data={products}
            keyExtractor={(p) => p.id}
            emptyMessage="No products found. Create your first product to get started."
          />

          {/* Pagination Controls */}
          {(prevCursor || hasMore) && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={!prevCursor}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasMore}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
