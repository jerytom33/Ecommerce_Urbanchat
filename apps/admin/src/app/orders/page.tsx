'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@ecommerce/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  status: string;
  subtotal: string;
  tax: string;
  shipping: string;
  discount: string;
  total: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Returned', value: 'returned' },
  { label: 'Cancelled', value: 'cancelled' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  returned: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'demo-tenant';

// ─── Component ───────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`${API_BASE}/api/v1/admin/orders?${params.toString()}`, {
        headers: { 'x-tenant-id': TENANT_ID },
      });

      if (res.ok) {
        const json: OrdersResponse = await res.json();
        setOrders(json.data);
        setHasMore(json.pagination.hasMore);
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when filter changes
  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  // Client-side search filter (filters by order ID)
  const filteredOrders = search
    ? orders.filter((o) => o.id.toLowerCase().includes(search.toLowerCase()))
    : orders;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Orders</h1>
        <p className="text-muted mt-1">View and manage customer orders</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search by order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            aria-label="Search orders"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-px" role="tablist" aria-label="Filter orders by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={statusFilter === tab.value}
            onClick={() => handleFilterChange(tab.value)}
            className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors ${
              statusFilter === tab.value
                ? 'bg-surface text-primary border-b-2 border-primary'
                : 'text-muted hover:text-text hover:bg-surface/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading orders" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-muted">
          No orders found.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm" role="table">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Order ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Total</th>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-primary hover:underline font-mono text-xs"
                    >
                      {order.id.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text font-medium">
                    {order.currency} {Number(order.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && (filteredOrders.length > 0 || page > 1) && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted">
            Page {page}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
