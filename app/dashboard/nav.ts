import type { NavItem } from "@/components/navigation/sidebar-nav";
import { hasPermission, type AuthorizedUser } from "@/lib/permissions";

/**
 * The sidebar a caller gets.
 *
 * Filtered on the server: a link the user may not follow is never rendered.
 * That is tidiness, not protection — every page and service checks for itself.
 *
 * Icons are named rather than imported here, because this list crosses into a
 * Client Component and only plain data may cross that boundary.
 */
export function navItemsFor(user: AuthorizedUser): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "خانه", icon: "home" },
  ];

  if (hasPermission(user, "academy:read")) {
    items.push(
      { href: "/dashboard/academy/sports", label: "رشته‌ها", icon: "sports" },
      {
        href: "/dashboard/academy/age-groups",
        label: "رده‌های سنی",
        icon: "ageGroups",
      },
      {
        href: "/dashboard/academy/seasons",
        label: "فصل‌ها",
        icon: "seasons",
      },
      {
        href: "/dashboard/academy/schools",
        label: "مدارس",
        icon: "schools",
      },
      { href: "/dashboard/academy/teams", label: "تیم‌ها", icon: "teams" },
    );
  }

  return items;
}
