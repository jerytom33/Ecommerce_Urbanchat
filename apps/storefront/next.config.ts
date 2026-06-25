import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ecommerce/ui'],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['@ecommerce/ui'],
  },
};

export default nextConfig;
