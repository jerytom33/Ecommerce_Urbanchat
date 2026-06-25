/**
 * Storefront API client for the mobile application.
 * Connects to the Storefront API for product, cart, and checkout data.
 */

import Constants from 'expo-constants';

const BASE_URL: string =
  Constants.expoConfig?.extra?.storefrontApiBaseUrl ||
  'http://localhost:3333/api/v1/storefront/';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * Make an authenticated request to the Storefront API.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', headers = {}, body, signal } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL}${endpoint.replace(/^\//, '')}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-tenant-id': 'dc35d0d1-67ad-4fcd-8c03-ff6382ed983d',
    'ngrok-skip-browser-warning': 'true',
    ...headers,
  };

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const responseData = response.ok ? await response.json() : null;
    const errorText = !response.ok ? await response.text() : null;

    return {
      data: responseData as T,
      error: errorText,
      status: response.status,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown network error';
    return {
      data: null,
      error: message,
      status: 0,
    };
  }
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

export { BASE_URL };
