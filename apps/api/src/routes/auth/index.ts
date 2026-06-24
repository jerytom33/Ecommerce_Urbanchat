import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { db, schema, eq, and } from '@ecommerce/database';
import { config } from '../../config.js';
import { validateBody } from '../../lib/validation.js';
import { AppError } from '../../plugins/error-handler.js';

/**
 * Password validation: minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Subdomain validation: 3-63 chars, lowercase alphanumeric/hyphens, start/end alphanumeric.
 */
const subdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(63, 'Subdomain must be at most 63 characters')
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    'Subdomain must contain only lowercase alphanumeric characters and hyphens, and must start and end with an alphanumeric character',
  );

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  tenantId: z.string().uuid('Invalid tenant ID'),
  role: z.enum(['owner', 'admin', 'staff', 'read-only']).optional().default('staff'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const registerMerchantSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
  storeName: z.string().min(1, 'Store name is required').max(255, 'Store name must be at most 255 characters'),
  subdomain: subdomainSchema,
});

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
}

/**
 * Generates a JWT access token with 15-minute expiry.
 */
function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessTokenExpiry,
  });
}

/**
 * Generates an opaque refresh token (UUID) and stores it in the database.
 */
async function generateRefreshToken(userId: string): Promise<string> {
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.jwt.refreshTokenExpiryDays);

  await db.insert(schema.refreshTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

/**
 * Auth routes registered under /api/v1/auth/
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/auth/register
   * Creates a new user with hashed password.
   */
  fastify.post('/register', async (request, reply) => {
    const body = validateBody(registerSchema, request);

    // Check if user already exists with this email in the tenant
    const existingUsers = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.email, body.email),
          eq(schema.users.tenantId, body.tenantId),
        ),
      );

    if (existingUsers.length > 0) {
      throw new AppError(409, 'USER_ALREADY_EXISTS', 'A user with this email already exists in this tenant');
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(body.password, config.bcrypt.saltRounds);

    // Insert user
    const [user] = await db
      .insert(schema.users)
      .values({
        email: body.email,
        passwordHash,
        tenantId: body.tenantId,
        role: body.role,
        firstName: body.firstName ?? null,
        lastName: body.lastName ?? null,
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        tenantId: schema.users.tenantId,
        createdAt: schema.users.createdAt,
      });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
      },
    });
  });

  /**
   * POST /api/v1/auth/login
   * Authenticates a user and returns JWT access + refresh tokens.
   */
  fastify.post('/login', async (request, reply) => {
    const body = validateBody(loginSchema, request);

    // Find user by email (across all tenants for login)
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, body.email))
      .limit(1);

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    const refreshToken = await generateRefreshToken(user.id);

    return reply.status(200).send({
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    });
  });

  /**
   * POST /api/v1/auth/refresh
   * Rotates the refresh token and issues a new access token.
   */
  fastify.post('/refresh', async (request, reply) => {
    const body = validateBody(refreshSchema, request);

    // Find the refresh token
    const [storedToken] = await db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.token, body.refreshToken))
      .limit(1);

    if (!storedToken) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    // Check if token is revoked
    if (storedToken.revoked) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has been revoked');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      // Revoke expired token
      await db
        .update(schema.refreshTokens)
        .set({ revoked: true })
        .where(eq(schema.refreshTokens.id, storedToken.id));

      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has expired');
    }

    // Revoke the old token (single-use rotation)
    await db
      .update(schema.refreshTokens)
      .set({ revoked: true })
      .where(eq(schema.refreshTokens.id, storedToken.id));

    // Get the user
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, storedToken.userId))
      .limit(1);

    if (!user) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'User associated with token not found');
    }

    // Generate new tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    const newRefreshToken = await generateRefreshToken(user.id);

    return reply.status(200).send({
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  /**
   * POST /api/v1/auth/register-merchant
   * Creates a new tenant and owner user in one step.
   * Validates subdomain, checks uniqueness, provisions tenant with free tier.
   */
  fastify.post('/register-merchant', async (request, reply) => {
    const body = validateBody(registerMerchantSchema, request);

    // Check subdomain uniqueness
    const existingTenants = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.subdomain, body.subdomain));

    if (existingTenants.length > 0) {
      throw new AppError(409, 'SUBDOMAIN_TAKEN', 'The requested subdomain is already in use');
    }

    // Create tenant record with default 'free' subscription tier
    const [tenant] = await db
      .insert(schema.tenants)
      .values({
        name: body.storeName,
        subdomain: body.subdomain,
        subscriptionTier: 'free',
        status: 'active',
        settings: {
          storeName: body.storeName,
          currency: 'USD',
          timezone: 'UTC',
        },
      })
      .returning({
        id: schema.tenants.id,
        name: schema.tenants.name,
        subdomain: schema.tenants.subdomain,
        subscriptionTier: schema.tenants.subscriptionTier,
        status: schema.tenants.status,
        createdAt: schema.tenants.createdAt,
      });

    // Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(body.password, config.bcrypt.saltRounds);

    // Create owner user linked to the new tenant
    const [user] = await db
      .insert(schema.users)
      .values({
        email: body.email,
        passwordHash,
        tenantId: tenant.id,
        role: 'owner',
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        tenantId: schema.users.tenantId,
        createdAt: schema.users.createdAt,
      });

    // Generate tokens for immediate login
    const accessToken = generateAccessToken({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
    });

    const refreshToken = await generateRefreshToken(user.id);

    return reply.status(201).send({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        subscriptionTier: tenant.subscriptionTier,
        status: tenant.status,
        createdAt: tenant.createdAt,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });
}
