export {
  ALL_PERMISSIONS,
  PERMISSIONS,
  splitPermission,
  type Permission,
} from "./catalogue";
export {
  ROLE_DEFINITIONS,
  findRoleDefinition,
  type RoleDefinition,
} from "./roles";
export {
  assertSelf,
  hasAnyPermission,
  hasPermission,
  hasRole,
  requireAnyPermission,
  requirePermission,
  requireRole,
  type AuthorizedUser,
} from "./authorize";
export { resolvePlayerScope, resolveScope } from "./resolve-scope";
export {
  UNRESTRICTED_SCOPE,
  assertWithinScope,
  isUnscoped,
  type ScopeFilter,
} from "./scope";
