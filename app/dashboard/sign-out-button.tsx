"use client";

import type * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignOutButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleSignOut(): Promise<void> {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {children}
    </Button>
  );
}
