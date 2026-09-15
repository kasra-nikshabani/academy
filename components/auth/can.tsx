import type * as React from "react";
import type { AuthorizedUser, Permission } from "@/lib/permissions";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

export interface CanProps {
  user: AuthorizedUser | null;
  /** Render the children only if the user holds this permission. */
  permission?: Permission;
  /** …or any one of these. */
  anyOf?: readonly Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Hides interface a caller cannot use.
 *
 * **This is presentation, not protection.** It keeps a coach from staring at a
 * disabled "delete academy" button; it does nothing to stop the request behind
 * that button. The same permission is checked again in the service, which is
 * where access is actually decided (docs/PERMISSIONS.md §4).
 */
export function Can({
  user,
  permission,
  anyOf,
  fallback = null,
  children,
}: CanProps) {
  if (!user) return <>{fallback}</>;

  const allowed = permission
    ? hasPermission(user, permission)
    : anyOf
      ? hasAnyPermission(user, anyOf)
      : false;

  return <>{allowed ? children : fallback}</>;
}
