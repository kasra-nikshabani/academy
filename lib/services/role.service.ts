import { requirePermission, type AuthorizedUser } from "@/lib/permissions";
import { PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import { ROLE_DEFINITIONS } from "@/lib/permissions/roles";
import { listRoles } from "@/lib/repositories/role.repository";

export interface RoleSummary {
  key: string;
  name: string;
  description: string | null;
  permissions: Array<{ key: Permission; description: string }>;
}

/** The role catalogue, for an administrator reviewing who can do what. */
export async function listRolesForCaller(
  caller: AuthorizedUser,
): Promise<RoleSummary[]> {
  requirePermission(caller, "role:read");

  const roles = await listRoles();

  return roles.map((role) => {
    const definition = ROLE_DEFINITIONS.find((item) => item.key === role.key);
    return {
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: (definition?.permissions ?? []).map((key) => ({
        key,
        description: PERMISSIONS[key],
      })),
    };
  });
}
