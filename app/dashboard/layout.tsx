import type * as React from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { findRoleDefinition } from "@/lib/permissions/roles";
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

  return (
    <AppShell
      navItems={navItemsFor(user)}
      roleNames={user.roles.map((key) => findRoleDefinition(key).name)}
    >
      {children}
    </AppShell>
  );
}
