import type * as React from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { findRoleDefinition } from "@/lib/permissions/roles";
import { myUnreadCount } from "@/lib/services/notification.service";
import { navItemsFor } from "./nav";

/**
 * Every signed-in screen sits inside this shell.
 *
 * The check here is authoritative, not the middleware's: middleware runs on
 * the edge and only sees the token, while this reads the user from the
 * database and so notices an account blocked a minute ago.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // One indexed `count` per navigation. A caller with no person record — a
  // bare administrator account — gets zero rather than an error, so a missing
  // inbox never takes the whole shell down.
  const unreadCount = await myUnreadCount(user);

  return (
    <AppShell
      navItems={navItemsFor(user)}
      roleNames={user.roles.map((key) => findRoleDefinition(key).name)}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
