import { ForbiddenError, OutOfScopeError } from "@/lib/errors";
import type { RoleKey } from "@/lib/generated/prisma/enums";
import type { Permission } from "./catalogue";

/**
 * The caller, as the authorization layer sees them.
 *
 * Roles and permissions are resolved once per request and passed down, so a
 * service never has to hit the database to answer "may they?".
 */
export interface AuthorizedUser {
  id: string;
  mobile: string;
  roles: readonly RoleKey[];
  permissions: readonly Permission[];
}

export function hasPermission(
  user: AuthorizedUser,
  permission: Permission,
): boolean {
  return user.permissions.includes(permission);
}

export function hasAnyPermission(
  user: AuthorizedUser,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasRole(user: AuthorizedUser, role: RoleKey): boolean {
  return user.roles.includes(role);
}

/**
 * Throws unless the caller holds the permission.
 *
 * Called from the **service** layer, never from a Route Handler alone: a
 * service may be reached from a route, a Server Action or a background job,
 * and a check that lives on one path is a bypass on the others
 * (docs/PERMISSIONS.md §4).
 */
export function requirePermission(
  user: AuthorizedUser,
  permission: Permission,
): void {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError();
  }
}

export function requireAnyPermission(
  user: AuthorizedUser,
  permissions: readonly Permission[],
): void {
  if (!hasAnyPermission(user, permissions)) {
    throw new ForbiddenError();
  }
}

export function requireRole(user: AuthorizedUser, role: RoleKey): void {
  if (!hasRole(user, role)) {
    throw new ForbiddenError();
  }
}

/**
 * Throws unless the record belongs to the caller.
 *
 * This is the scope check that already means something: a signed-in user
 * reaching for their own record. It is what stops someone swapping an id in a
 * URL for somebody else's.
 *
 * ADMIN is deliberately **not** waved through here — a caller with
 * `user:read` reaches other people's records through that permission, not by
 * having self-scope quietly widened.
 */
export function assertSelf(user: AuthorizedUser, targetUserId: string): void {
  if (user.id !== targetUserId) {
    throw new OutOfScopeError();
  }
}
