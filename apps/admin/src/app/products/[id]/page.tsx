'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Input, Badge, Table, Modal } from '@ecommerce/ui';
import type { TableColumn } from '@ecommerce/ui';
import { apiFetch } from '../../../lib/api';
import type { ApiError } from '../../../lib/api';

interface Category {
  id: string;
  name: string;
  depth: number;
}

interface Listing {
  id: string;
  sku: string;
  price: number;
  inventoryQuantity: number;
  status: 'active' | 'inactive';
}

interface Product {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  categoryId: string | null;
  metadata: Record<string, unknown>;
  listings: Listing[];
}

interface ProductFormData {
  title: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  categoryId: string;
  metadata: string;
}

interface ListingFormData {
  sku: string;
  price: string;
  inventoryQuantity: string;
  status: 'active' | 'inactive';
}

const EMPTY_LISTING_FORM: ListingFormData = {
  sku: '',
  price: '',
  inventoryQuantity: '0',
  status: 'active',
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [form, setForm] = useState<ProductFormData>({
    title: '',
    description: '',
    status: 'draft',
    categoryId: '',
    metadata: '{}',
  });
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Listings state
  const [listings, setListings] = useState<Listing[]>([]);
  const [showListingForm, setShowListingForm] = useState(false);
  const [listingForm, setListingForm] = useState<ListingFormData>(EMPTY_LISTING_FORM);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [listingErrors, setListingErrors] = useState<Record<string, string>>({});
  const [listingLoading, setListingLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    try {
      const result = await apiFetch<Product>(`/products/${productId}`);
      setProduct(result);
      setForm({
        title: result.title,
        description: result.description || '',
        status: result.status,
        categoryId: result.categoryId || '',
        metadata: JSON.stringify(result.metadata || {}, null, 2),
      });
      setListings(result.listings || []);
    } catch (err) {
      const apiError = err as ApiError;
      setGeneralError(apiError.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const result = await apiFetch<{ data: Category[] }>('/categories');
        setCategories(result.data);
      } catch {
        // Categories are optional
      }
    }
    loadCategories();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.title.trim()) {
      errors.title = 'Title is required';
    } else if (form.title.length > 255) {
      errors.title = 'Title must be 255 characters or less';
    }

    if (form.description.length > 10000) {
      errors.description = 'Description must be 10,000 characters or less';
    }

    if (form.metadata.trim()) {
      try {
        JSON.parse(form.metadata);
      } catch {
        errors.metadata = 'Metadata must be valid JSON';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateForm()) return;

    setSaving(true);
    try {
      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(form.metadata);
      } catch {
        // Already validated
      }

      await apiFetch(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          status: form.status,
          categoryId: form.categoryId || undefined,
          metadata: parsedMetadata,
        }),
      });

      router.push('/products?updated=true');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.errors) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(apiError.errors)) {
          mapped[field] = messages.join(', ');
        }
        setFieldErrors(mapped);
      } else {
        setGeneralError(apiError.message || 'Failed to update product');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/products/${productId}`, {
        method: 'DELETE',
      });
      router.push('/products?deleted=true');
    } catch (err) {
      const apiError = err as ApiError;
      setGeneralError(apiError.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleFieldChange = (field: keyof ProductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Listing management
  const validateListingForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!listingForm.sku.trim()) {
      errors.sku = 'SKU is required';
    } else if (listingForm.sku.length > 64) {
      errors.sku = 'SKU must be 64 characters or less';
    }

    const price = parseFloat(listingForm.price);
    if (!listingForm.price || isNaN(price)) {
      errors.price = 'Price is required';
    } else if (price < 0.01 || price > 999999999.99) {
      errors.price = 'Price must be between 0.01 and 999,999,999.99';
    }

    const qty = parseInt(listingForm.inventoryQuantity, 10);
    if (isNaN(qty) || qty < 0 || qty > 999999) {
      errors.inventoryQuantity = 'Inventory must be between 0 and 999,999';
    }

    setListingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddListing = async () => {
    if (!validateListingForm()) return;

    setListingLoading(true);
    try {
      const body = {
        sku: listingForm.sku.trim(),
        price: parseFloat(listingForm.price),
        inventoryQuantity: parseInt(listingForm.inventoryQuantity, 10),
        status: listingForm.status,
      };

      if (editingListingId) {
        await apiFetch(`/products/${productId}/listings/${editingListingId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/products/${productId}/listings`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      // Reload product to get updated listings
      await loadProduct();
      resetListingForm();
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.errors) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(apiError.errors)) {
          mapped[field] = messages.join(', ');
        }
        setListingErrors(mapped);
      } else {
        setListingErrors({ general: apiError.message || 'Failed to save listing' });
      }
    } finally {
      setListingLoading(false);
    }
  };

  const handleEditListing = (listing: Listing) => {
    setEditingListingId(listing.id);
    setListingForm({
      sku: listing.sku,
      price: listing.price.toString(),
      inventoryQuantity: listing.inventoryQuantity.toString(),
      status: listing.status,
    });
    setShowListingForm(true);
    setListingErrors({});
  };

  const handleDeleteListing = async (listingId: string) => {
    try {
      await apiFetch(`/products/${productId}/listings/${listingId}`, {
        method: 'DELETE',
      });
      await loadProduct();
      setDeleteConfirmId(null);
    } catch (err) {
      const apiError = err as ApiError;
      setGeneralError(apiError.message || 'Failed to delete listing');
      setDeleteConfirmId(null);
    }
  };

  const resetListingForm = () => {
    setShowListingForm(false);
    setEditingListingId(null);
    setListingForm(EMPTY_LISTING_FORM);
    setListingErrors({});
  };

  const listingColumns: TableColumn<Listing>[] = [
    { key: 'sku', header: 'SKU' },
    {
      key: 'price',
      header: 'Price',
      render: (listing) => `$${listing.price.toFixed(2)}`,
    },
    {
      key: 'inventoryQuantity',
      header: 'Inventory',
      render: (listing) => listing.inventoryQuantity.toLocaleString(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (listing) => (
        <Badge variant={listing.status === 'active' ? 'success' : 'default'}>
          {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (listing) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleEditListing(listing)}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirmId(listing.id)}
            className="text-sm text-error hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!product && generalError) {
    return (
      <div className="space-y-4">
        <div className="bg-error/10 border border-error/20 rounded-md p-4">
          <p className="text-sm text-error">{generalError}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/products')}>
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Edit Product</h1>
          <p className="text-muted mt-1">Update product details and manage listings</p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          loading={deleting}
        >
          Archive Product
        </Button>
      </div>

      {/* General Error */}
      {generalError && (
        <div className="bg-error/10 border border-error/20 rounded-md p-4">
          <p className="text-sm text-error">{generalError}</p>
        </div>
      )}

      {/* Product Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <Input
          label="Title"
          placeholder="Enter product title"
          value={form.title}
          onChange={(e) => handleFieldChange('title', e.target.value)}
          error={fieldErrors.title}
          required
          maxLength={255}
        />

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium text-text">
            Description
          </label>
          <textarea
            id="description"
            placeholder="Enter product description (optional)"
            value={form.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            maxLength={10000}
            rows={5}
            className={`w-full px-3 py-2 text-sm border rounded-md bg-background text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-y ${
              fieldErrors.description ? 'border-error focus:ring-error/50 focus:border-error' : 'border-border'
            }`}
            aria-invalid={fieldErrors.description ? 'true' : undefined}
            aria-describedby={fieldErrors.description ? 'description-error' : 'description-count'}
          />
          <div className="flex justify-between items-center">
            {fieldErrors.description ? (
              <p id="description-error" className="text-sm text-error" role="alert">
                {fieldErrors.description}
              </p>
            ) : (
              <span />
            )}
            <span id="description-count" className="text-xs text-muted">
              {form.description.length.toLocaleString()} / 10,000
            </span>
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-text">
            Status
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => handleFieldChange('status', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium text-text">
            Category
          </label>
          <select
            id="category"
            value={form.categoryId}
            onChange={(e) => handleFieldChange('categoryId', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {'—'.repeat(cat.depth)} {cat.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && (
            <p className="text-sm text-error" role="alert">
              {fieldErrors.categoryId}
            </p>
          )}
        </div>

        {/* Metadata JSON */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="metadata" className="text-sm font-medium text-text">
            Metadata (JSON)
          </label>
          <textarea
            id="metadata"
            placeholder='{"key": "value"}'
            value={form.metadata}
            onChange={(e) => handleFieldChange('metadata', e.target.value)}
            rows={4}
            className={`w-full px-3 py-2 text-sm font-mono border rounded-md bg-background text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-y ${
              fieldErrors.metadata ? 'border-error focus:ring-error/50 focus:border-error' : 'border-border'
            }`}
            aria-invalid={fieldErrors.metadata ? 'true' : undefined}
            aria-describedby={fieldErrors.metadata ? 'metadata-error' : undefined}
          />
          {fieldErrors.metadata && (
            <p id="metadata-error" className="text-sm text-error" role="alert">
              {fieldErrors.metadata}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button type="submit" loading={saving}>
            Save Changes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/products')}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Listings Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Listings</h2>
          <Button
            size="sm"
            onClick={() => {
              resetListingForm();
              setShowListingForm(true);
            }}
          >
            Add Listing
          </Button>
        </div>

        {/* Listing Form (inline) */}
        {showListingForm && (
          <div className="border border-border rounded-lg p-4 space-y-4 bg-surface/50">
            <h3 className="text-sm font-medium text-text">
              {editingListingId ? 'Edit Listing' : 'New Listing'}
            </h3>

            {listingErrors.general && (
              <div className="bg-error/10 border border-error/20 rounded-md p-3">
                <p className="text-sm text-error">{listingErrors.general}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="SKU"
                placeholder="e.g., PROD-001-BLK"
                value={listingForm.sku}
                onChange={(e) => setListingForm((f) => ({ ...f, sku: e.target.value }))}
                error={listingErrors.sku}
                maxLength={64}
              />
              <Input
                label="Price"
                type="number"
                step="0.01"
                min="0.01"
                max="999999999.99"
                placeholder="0.00"
                value={listingForm.price}
                onChange={(e) => setListingForm((f) => ({ ...f, price: e.target.value }))}
                error={listingErrors.price}
              />
              <Input
                label="Inventory Quantity"
                type="number"
                min="0"
                max="999999"
                placeholder="0"
                value={listingForm.inventoryQuantity}
                onChange={(e) => setListingForm((f) => ({ ...f, inventoryQuantity: e.target.value }))}
                error={listingErrors.inventoryQuantity}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="listing-status" className="text-sm font-medium text-text">
                  Status
                </label>
                <select
                  id="listing-status"
                  value={listingForm.status}
                  onChange={(e) =>
                    setListingForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddListing}
                loading={listingLoading}
              >
                {editingListingId ? 'Update Listing' : 'Add Listing'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={resetListingForm}
                disabled={listingLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Listings Table */}
        <Table<Listing>
          columns={listingColumns}
          data={listings}
          keyExtractor={(l) => l.id}
          emptyMessage="No listings yet. Add a listing to make this product available for sale."
        />
      </div>

      {/* Delete Listing Confirmation Modal */}
      <Modal
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Listing"
      >
        <p className="text-sm text-text mb-4">
          Are you sure you want to delete this listing? This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteConfirmId && handleDeleteListing(deleteConfirmId)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
