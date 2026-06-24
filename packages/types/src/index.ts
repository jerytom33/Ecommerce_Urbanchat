/**
 * Shared TypeScript types for the E-commerce SaaS Platform.
 * This package contains type definitions used across all apps and packages.
 */

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    hasMore: boolean;
    totalCount?: number;
  };
}

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: SubscriptionPlan;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionPlan = 'free' | 'basic' | 'professional' | 'enterprise';

export type UserRole = 'owner' | 'admin' | 'staff' | 'read-only';
