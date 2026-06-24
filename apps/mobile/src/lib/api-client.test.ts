import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock expo-constants before importing api-client
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        storefrontApiBaseUrl: 'http://localhost:3333/api/v1/storefront/',
      },
    },
  },
}));

import { api, apiRequest, BASE_URL } from './api-client';

describe('api-client', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ products: [] }),
        text: () => Promise.resolve(''),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BASE_URL', () => {
    it('should default to localhost storefront API URL', () => {
      expect(BASE_URL).toBe('http://localhost:3333/api/v1/storefront/');
    });
  });

  describe('apiRequest', () => {
    it('should make a GET request by default', async () => {
      const result = await apiRequest('products');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3333/api/v1/storefront/products',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );
      expect(result.data).toEqual({ products: [] });
      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it('should handle absolute URLs', async () => {
      await apiRequest('http://custom.api.com/data');

      expect(fetch).toHaveBeenCalledWith(
        'http://custom.api.com/data',
        expect.anything()
      );
    });

    it('should strip leading slash from relative endpoints', async () => {
      await apiRequest('/products');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3333/api/v1/storefront/products',
        expect.anything()
      );
    });

    it('should return error on non-OK response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: () => Promise.resolve(null),
          text: () => Promise.resolve('Not Found'),
        })
      );

      const result = await apiRequest('missing');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Not Found');
      expect(result.status).toBe(404);
    });

    it('should handle network errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network request failed'))
      );

      const result = await apiRequest('products');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Network request failed');
      expect(result.status).toBe(0);
    });

    it('should send JSON body for POST requests', async () => {
      await apiRequest('cart/items', {
        method: 'POST',
        body: { productId: '123', quantity: 1 },
      });

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3333/api/v1/storefront/cart/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ productId: '123', quantity: 1 }),
        })
      );
    });
  });

  describe('api convenience methods', () => {
    it('api.get should make GET request', async () => {
      const result = await api.get('products');
      expect(result.status).toBe(200);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('products'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('api.post should make POST request with body', async () => {
      await api.post('cart', { item: 'abc' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('cart'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ item: 'abc' }),
        })
      );
    });

    it('api.put should make PUT request', async () => {
      await api.put('cart/1', { quantity: 2 });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('cart/1'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('api.delete should make DELETE request', async () => {
      await api.delete('cart/1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('cart/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
