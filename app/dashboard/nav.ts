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

  if (hasPermission(user, "player:read")) {
    items.push({
      href: "/dashboard/people/players",
      label: "بازیکنان",
      icon: "players",
    });
  }

  // Training sits above the people lists: for a coach it is the screen they
  // open every day, and for a player or parent it is most of what they came
  // for.
  if (hasPermission(user, "training:read")) {
    items.push(
      { href: "/dashboard/training", label: "تمرین", icon: "training" },
      {
        href: "/dashboard/training/plans",
        label: "برنامه‌های تمرین",
        icon: "plans",
      },
    );
  }

  if (hasPermission(user, "staff:read")) {
    items.push({
      href: "/dashboard/people/staff",
      label: "کادر فنی",
      icon: "staff",
    });
  }

  return items;
}
