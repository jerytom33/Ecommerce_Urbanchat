/**
 * Application configuration loaded from environment variables.
 */
export const config = {
  port: parseInt(process.env.API_PORT || '3001', 10),
  host: process.env.API_HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8081',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_prototype',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    accessTokenExpiry: '15m',
    refreshTokenExpiryDays: 7,
  },
  bcrypt: {
    saltRounds: 12,
  },
} as const;
