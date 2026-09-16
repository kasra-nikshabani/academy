import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { findRoleDefinition } from "@/lib/permissions/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/me — the signed-in user, with what they may do.
 *
 * Permissions are returned so the interface can hide what the caller cannot
 * use. That is presentation only: the same checks run again in the service
 * layer, because a hidden button is not a control (docs/PERMISSIONS.md §4).
 */
export const GET = apiHandler(async () => {
  const user = await requireUser();

  return ok({
    id: user.id,
    mobile: user.mobile,
    status: user.account.status,
    lastLoginAt: user.account.lastLoginAt,
    roles: user.roles.map((key) => {
      const definition = findRoleDefinition(key);
      return { key, name: definition.name };
    }),
    permissions: user.permissions.map((key) => ({
      key,
      description: PERMISSIONS[key],
    })),
  });
});
