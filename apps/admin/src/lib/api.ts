/**
 * API utility for the admin panel.
 * Provides a fetch wrapper with tenant context headers and error handling.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api/v1/admin';
const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'dc35d0d1-67ad-4fcd-8c03-ff6382ed983d';

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': DEFAULT_TENANT_ID,
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiError;
    try {
      const body = await response.json();
      errorData = {
        message: body.message || `Request failed with status ${response.status}`,
        errors: body.errors,
        statusCode: response.status,
      };
    } catch {
      errorData = {
        message: `Request failed with status ${response.status}`,
        statusCode: response.status,
      };
    }
    throw errorData;
  }

  return response.json() as Promise<T>;
}
