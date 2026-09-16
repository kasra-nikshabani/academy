import { UnauthenticatedError } from "@/lib/errors";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { findUserById } from "@/lib/repositories/user.repository";
import type { AuthorizedUser } from "@/lib/permissions/authorize";
import type { Permission } from "@/lib/permissions/catalogue";
import { ALL_PERMISSIONS } from "@/lib/permissions/catalogue";
import type { User } from "@/lib/generated/prisma/client";
import { readSessionCookie, verifySessionToken } from "./session";

export interface CurrentUser extends AuthorizedUser {
  account: User;
}

/** Keys stored in the database that are no longer in the catalogue are dropped. */
function toKnownPermissions(keys: readonly string[]): Permission[] {
  const known = new Set<string>(ALL_PERMISSIONS);
  return keys.filter((key): key is Permission => known.has(key));
}

/**
 * Resolves the caller from the session cookie, with their roles and
 * permissions, or null when there is none.
 *
 * The user is re-read from the database on every call rather than trusted from
 * the token: a user blocked, deactivated, or stripped of a role by an
 * administrator must lose access immediately, not when their 12-hour token
 * happens to expire. That is also why roles are not baked into the JWT.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await readSessionCookie();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const account = await findUserById(payload.sub);
  if (!account || account.status !== "ACTIVE") return null;

  const { roles, permissionKeys } = await findUserAuthorization(account.id);

  return {
    id: account.id,
    mobile: account.mobile,
    roles,
    permissions: toKnownPermissions(permissionKeys),
    account,
  };
}

/** Same as `getCurrentUser`, but for paths that require a signed-in caller. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}
