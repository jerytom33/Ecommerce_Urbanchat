'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button, Input, Card, CardHeader, CardContent } from '@ecommerce/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  listingId: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: string;
  fulfillmentStatus: string;
  carrierName: string | null;
  trackingNumber: string | null;
  createdAt: string;
}

interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface OrderDetail {
  id: string;
  customerId: string | null;
  status: string;
  subtotal: string;
  tax: string;
  shipping: string;
  discount: string;
  total: string;
  currency: string;
  shippingAddress: Address | null;
  billingAddress: Address | null;
  lineItems: LineItem[];
  createdAt: string;
  updatedAt: string;
}

interface Notification {
  id: string;
  type: string;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned' | 'cancelled';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  returned: [],
  cancelled: [],
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  returned: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
};

const FULFILLMENT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
};

const API_BASE = 'http://localhost:3333';
const TENANT_ID = 'dc35d0d1-67ad-4fcd-8c03-ff6382ed983d';

// ─── Component ───────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Fulfillment form state
  const [selectedLineItems, setSelectedLineItems] = useState<string[]>([]);
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [fulfilling, setFulfilling] = useState(false);
  const [fulfillError, setFulfillError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/orders/${orderId}`, {
        headers: { 'x-tenant-id': TENANT_ID },
      });

      if (res.ok) {
        const json = await res.json();
        setOrder(json.data);
      } else if (res.status === 404) {
        setError('Order not found');
      } else {
        setError('Failed to load order');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/notifications?orderId=${orderId}`, {
        headers: { 'x-tenant-id': TENANT_ID },
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch {
      // Notifications endpoint may not exist yet — that's fine
      setNotifications([]);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    fetchNotifications();
  }, [fetchOrder, fetchNotifications]);

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await fetchOrder();
      } else {
        const json = await res.json();
        setError(json.error?.message || 'Status update failed');
      }
    } catch {
      setError('Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLineItems.length === 0 || !carrierName || !trackingNumber) {
      setFulfillError('Please select line items and fill in carrier details');
      return;
    }

    setFulfilling(true);
    setFulfillError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/orders/${orderId}/fulfill`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID,
        },
        body: JSON.stringify({
          lineItemIds: selectedLineItems,
          carrierName,
          trackingNumber,
        }),
      });

      if (res.ok) {
        setSelectedLineItems([]);
        setCarrierName('');
        setTrackingNumber('');
        await fetchOrder();
      } else {
        const json = await res.json();
        setFulfillError(json.error?.message || 'Fulfillment failed');
      }
    } catch {
      setFulfillError('Failed to fulfill items');
    } finally {
      setFulfilling(false);
    }
  };

  const toggleLineItem = (itemId: string) => {
    setSelectedLineItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading order" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.push('/orders')} className="text-sm text-primary hover:underline">
          ← Back to Orders
        </button>
        <div className="text-center py-12 text-error">{error}</div>
      </div>
    );
  }

  if (!order) return null;

  const currentStatus = order.status as OrderStatus;
  const validTransitions = ALLOWED_TRANSITIONS[currentStatus] || [];
  const unfulfilledItems = order.lineItems.filter((li) => li.fulfillmentStatus === 'pending');
  const formatAddress = (addr: Address | null) => {
    if (!addr) return 'Not provided';
    const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean);
    return parts.join(', ') || 'Not provided';
  };

  return (
    <div className="space-y-6">
      {/* Back link + Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/orders')} className="text-sm text-primary hover:underline mb-2 block">
            ← Back to Orders
          </button>
          <h1 className="text-2xl font-bold text-text flex items-center gap-3">
            Order {order.id.slice(0, 8)}...
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
              {order.status}
            </span>
          </h1>
          <p className="text-muted mt-1 text-sm">
            Created {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-error bg-error/10 rounded-md" role="alert">
          {error}
        </div>
      )}

      {/* Order Summary + Shipping */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Totals */}
        <Card padding="md">
          <CardHeader>
            <h2 className="text-sm font-semibold text-text">Order Summary</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-text font-medium">{order.currency} {Number(order.subtotal).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Tax</dt>
                <dd className="text-text">{order.currency} {Number(order.tax).toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="text-text">{order.currency} {Number(order.shipping).toFixed(2)}</dd>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Discount</dt>
                  <dd className="text-green-600">-{order.currency} {Number(order.discount).toFixed(2)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border">
                <dt className="text-text font-semibold">Total</dt>
                <dd className="text-text font-bold">{order.currency} {Number(order.total).toFixed(2)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Customer + Shipping Address */}
        <Card padding="md">
          <CardHeader>
            <h2 className="text-sm font-semibold text-text">Shipping Details</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Customer ID</dt>
                <dd className="text-text font-mono text-xs">{order.customerId || 'Guest'}</dd>
              </div>
              <div>
                <dt className="text-muted">Shipping Address</dt>
                <dd className="text-text">{formatAddress(order.shippingAddress)}</dd>
              </div>
              <div>
                <dt className="text-muted">Date</dt>
                <dd className="text-text">{new Date(order.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card padding="none">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Qty</th>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Unit Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted" scope="col">Fulfillment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.lineItems.map((item) => (
                <tr key={item.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 text-text">{item.title}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{item.sku || '—'}</td>
                  <td className="px-4 py-3 text-text">{item.quantity}</td>
                  <td className="px-4 py-3 text-text">{order.currency} {Number(item.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full capitalize ${FULFILLMENT_COLORS[item.fulfillmentStatus] || 'bg-gray-100 text-gray-800'}`}>
                      {item.fulfillmentStatus}
                    </span>
                    {item.trackingNumber && (
                      <span className="ml-2 text-xs text-muted">
                        {item.carrierName}: {item.trackingNumber}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Fulfillment Panel */}
      <Card padding="md">
        <CardHeader>
          <h2 className="text-sm font-semibold text-text">Fulfillment</h2>
        </CardHeader>
        <CardContent>
          {/* Status transition buttons */}
          <div className="mb-4">
            <p className="text-sm text-muted mb-2">Status Actions</p>
            {validTransitions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {validTransitions.map((status) => (
                  <Button
                    key={status}
                    variant={status === 'cancelled' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(status)}
                    disabled={statusUpdating}
                    loading={statusUpdating}
                  >
                    Mark as {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted italic">No status transitions available (terminal state).</p>
            )}
          </div>

          {/* Mark as Shipped form */}
          {unfulfilledItems.length > 0 && (
            <form onSubmit={handleFulfill} className="border-t border-border pt-4 space-y-4">
              <h3 className="text-sm font-medium text-text">Ship Items</h3>

              {/* Line item selection */}
              <div className="space-y-2">
                <p className="text-sm text-muted">Select items to fulfill:</p>
                {unfulfilledItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLineItems.includes(item.id)}
                      onChange={() => toggleLineItem(item.id)}
                      className="rounded border-border text-primary focus:ring-primary/50"
                    />
                    <span className="text-text">{item.title}</span>
                    <span className="text-muted">({item.sku || 'No SKU'}) × {item.quantity}</span>
                  </label>
                ))}
              </div>

              {/* Carrier and tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Carrier Name"
                  placeholder="e.g. UPS, FedEx, USPS"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                />
                <Input
                  label="Tracking Number"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>

              {fulfillError && (
                <div className="text-sm text-error" role="alert">{fulfillError}</div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={fulfilling}
                disabled={selectedLineItems.length === 0 || !carrierName || !trackingNumber}
              >
                Mark as Shipped
              </Button>
            </form>
          )}

          {unfulfilledItems.length === 0 && order.lineItems.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-green-600 font-medium">All items have been fulfilled.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Log */}
      <Card padding="md">
        <CardHeader>
          <h2 className="text-sm font-semibold text-text">Notification Log</h2>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted">No notifications sent for this order yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => (
                <div key={notif.id} className="flex items-start gap-3 text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <p className="text-text font-medium">{notif.subject || notif.type}</p>
                    <p className="text-muted text-xs">
                      {notif.channel} → {notif.recipient}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                      notif.status === 'sent' ? 'bg-green-100 text-green-800' :
                      notif.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {notif.status}
                    </span>
                    <p className="text-muted text-xs mt-1">
                      {new Date(notif.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
