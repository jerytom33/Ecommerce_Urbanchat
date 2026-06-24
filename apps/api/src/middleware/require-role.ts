import { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../plugins/error-handler.js';

/**
 * Valid tenant roles in the platform RBAC system.
 *
 * Role hierarchy (from most to least privileged):
 * - owner: Full account management including billing and role assignment
 * - admin: Catalog, order, and staff management
 * - staff: Catalog and order operations only
 * - read-only: View-only access to all non-billing data
 */
export type TenantRole = 'owner' | 'admin' | 'staff' | 'read-only';

/**
 * Creates a Fastify preHandler hook that enforces role-based access control.
 *
 * Must be used after the `authenticate` middleware, which attaches `request.user`
 * with the decoded JWT payload including the user's role.
 *
 * @param allowedRoles - One or more roles permitted to access the route
 * @returns A Fastify preHandler function that checks the user's role
 *
 * @example
 * fastify.get('/admin/billing', { preHandler: [authenticate, requireRole('owner')] }, handler)
 * fastify.post('/admin/products', { preHandler: [authenticate, requireRole('owner', 'admin', 'staff')] }, handler)
 */
export function requireRole(...allowedRoles: TenantRole[]) {
  return async function checkRole(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const user = request.user;

    if (!user) {
      throw new AppError(
        401,
        'AUTHENTICATION_REQUIRED',
        'Authentication is required before role authorization',
      );
    }

    const userRole = user.role as TenantRole;

    if (!allowedRoles.includes(userRole)) {
      throw new AppError(
        403,
        'INSUFFICIENT_PERMISSIONS',
        `Role '${userRole}' does not have permission to access this resource. Required: ${allowedRoles.join(', ')}`,
      );
    }
  };
}
