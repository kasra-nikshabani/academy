import type * as React from "react";
import { LogOut } from "lucide-react";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { SidebarNav, type NavItem } from "@/components/navigation/sidebar-nav";
import { SignOutButton } from "@/app/dashboard/sign-out-button";

export interface AppShellProps {
  navItems: readonly NavItem[];
  /** Role names, shown under the brand so a user knows how they signed in. */
  roleNames: readonly string[];
  children: React.ReactNode;
}

/**
 * The signed-in frame: crest-black chrome, light content.
 *
 * The black-and-gold pairing is the club's identity, so the shell carries it
 * and the working area stays calm and readable (docs/UI_UX.md §1).
 *
 * On phones the sidebar drops away and becomes a horizontal strip — coaches
 * and parents work from a phone (docs/UI_UX.md §6).
 */
export function AppShell({ navItems, roleNames, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground lg:w-64 lg:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:block lg:space-y-4">
          <BrandLockup size="sm" className="[&_p:last-child]:text-white/60" />
          <div className="lg:hidden">
            <SignOutButton>
              <LogOut className="size-4" />
              خروج
            </SignOutButton>
          </div>
        </div>

        <div className="overflow-x-auto px-2 pb-3 lg:px-3">
          <div className="min-w-max lg:min-w-0">
            <SidebarNav items={navItems} />
          </div>
        </div>

        <div className="hidden border-t border-white/10 px-4 py-3 lg:block">
          <p className="text-xs text-white/50">
            {roleNames.length > 0 ? roleNames.join(" · ") : "بدون نقش"}
          </p>
          <div className="mt-2">
            <SignOutButton>
              <LogOut className="size-4" />
              خروج
            </SignOutButton>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
