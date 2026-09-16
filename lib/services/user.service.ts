import { buildPaginationMeta, type PaginationQuery } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import {
  assertSelf,
  hasPermission,
  requirePermission,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findUserById,
  listUsers,
  type UserListItem,
} from "@/lib/repositories/user.repository";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import type { PaginationMeta } from "@/lib/api";

/**
 * All authorization for user records lives here, not in the route handler —
 * a service can be reached from a route, a Server Action or a job, and a check
 * on one path is a bypass on the others (CLAUDE.md §4).
 */

export async function listUsersForCaller(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  search?: string,
): Promise<{ items: UserListItem[]; meta: PaginationMeta }> {
  requirePermission(caller, "user:read");

  const { items, total } = await listUsers({
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
    ...(search ? { search } : {}),
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

/**
 * One user.
 *
 * Reading somebody else requires `user:read`; reading yourself never does.
 * Without the self case, a player fetching their own record would need the
 * same permission an administrator uses to read everyone's.
 */
export async function getUserForCaller(
  caller: AuthorizedUser,
  targetUserId: string,
): Promise<UserListItem> {
  if (!hasPermission(caller, "user:read")) {
    assertSelf(caller, targetUserId);
  }

  const user = await findUserById(targetUserId);
  if (!user) throw new NotFoundError("کاربر مورد نظر یافت نشد.");

  const { roles } = await findUserAuthorization(user.id);

  return {
    id: user.id,
    mobile: user.mobile,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    roles,
  };
}
