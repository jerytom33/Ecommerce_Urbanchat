'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@ecommerce/ui';
import { apiFetch } from '../../../lib/api';
import type { ApiError } from '../../../lib/api';

interface Category {
  id: string;
  name: string;
  depth: number;
}

interface ProductFormData {
  title: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  categoryId: string;
  metadata: string;
}

export default function CreateProductPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>({
    title: '',
    description: '',
    status: 'draft',
    categoryId: '',
    metadata: '{}',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      try {
        const result = await apiFetch<{ data: Category[] }>('/categories');
        setCategories(result.data);
      } catch {
        // Categories are optional; silently handle
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

    setLoading(true);
    try {
      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(form.metadata);
      } catch {
        // Already validated
      }

      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          status: form.status,
          categoryId: form.categoryId || undefined,
          metadata: parsedMetadata,
        }),
      });

      setSuccess(true);
      // Redirect with success indication
      router.push('/products?created=true');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.errors) {
        // Map server field errors to our form
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(apiError.errors)) {
          mapped[field] = messages.join(', ');
        }
        setFieldErrors(mapped);
      } else {
        setGeneralError(apiError.message || 'Failed to create product');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof ProductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Create Product</h1>
        <p className="text-muted mt-1">Add a new product to your catalog</p>
      </div>

      {/* General Error */}
      {generalError && (
        <div className="bg-error/10 border border-error/20 rounded-md p-4">
          <p className="text-sm text-error">{generalError}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-success/10 border border-success/20 rounded-md p-4">
          <p className="text-sm text-success">Product created successfully! Redirecting...</p>
        </div>
      )}

      {/* Form */}
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
          <Button type="submit" loading={loading} disabled={success}>
            Create Product
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/products')}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
