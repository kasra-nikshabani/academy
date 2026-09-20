"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  FileSpreadsheet,
  Filter,
  Search,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Shapes,
  Swords,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icons are referenced by name, not passed as components.
 *
 * A Lucide icon is a React component — an object with methods — and only plain
 * data may cross from a Server Component to a Client Component. Passing the
 * component itself throws at render. The name is a string, so the nav can be
 * assembled on the server (where permissions are known) and drawn here.
 */
export type NavIconName =
  | "home"
  | "sports"
  | "ageGroups"
  | "seasons"
  | "schools"
  | "teams"
  | "players"
  | "staff"
  | "training"
  | "plans"
  | "tryouts"
  | "evaluations"
  | "pipeline"
  | "matches"
  | "performance"
  | "announcements"
  | "reports";

const ICONS: Record<NavIconName, LucideIcon> = {
  home: LayoutDashboard,
  sports: Trophy,
  ageGroups: Shapes,
  seasons: CalendarDays,
  schools: GraduationCap,
  teams: Users,
  players: UsersRound,
  staff: UserCog,
  training: Dumbbell,
  plans: ClipboardList,
  tryouts: Search,
  evaluations: ClipboardCheck,
  pipeline: Filter,
  matches: Swords,
  performance: TrendingUp,
  announcements: Megaphone,
  reports: FileSpreadsheet,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export interface SidebarNavProps {
  items: readonly NavItem[];
}

/** Sidebar links, with the current section marked. */
export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  /**
   * Only the deepest matching link is marked current.
   *
   * A plain prefix test would light up "خانه" (/dashboard) on every page
   * beneath it, so the longest match wins instead.
   */
  const activeHref = items
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .reduce<string | null>(
      (longest, item) =>
        longest === null || item.href.length > longest.length
          ? item.href
          : longest,
      null,
    );

  return (
    <nav aria-label="منوی اصلی" className="flex gap-1 lg:block lg:space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === activeHref;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors lg:gap-3",
              active
                ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
