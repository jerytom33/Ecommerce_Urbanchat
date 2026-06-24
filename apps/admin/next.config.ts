import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ecommerce/ui'],
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@ecommerce/ui'],
  },
};

export default nextConfig;
