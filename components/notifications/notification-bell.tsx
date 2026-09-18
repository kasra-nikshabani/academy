import Link from "next/link";
import { Bell } from "lucide-react";
import { toPersianDigits } from "@/lib/utils/number";

export interface NotificationBellProps {
  unreadCount: number;
}

/**
 * The inbox indicator, on every signed-in page.
 *
 * A Server Component and a plain link: the count is rendered with the page, so
 * there is no polling and no client JavaScript for what is a number and a
 * destination. It goes stale between navigations, which is the right trade —
 * a badge that is a minute old costs nothing, and a request every thirty
 * seconds from every open tab costs a great deal.
 *
 * The count is in the accessible name, not only in the badge: "۳ اعلان
 * خوانده‌نشده" is what a screen reader announces, where a bare "اعلان‌ها" plus
 * a floating number is what it would otherwise get.
 */
export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const label =
    unreadCount > 0
      ? `اعلان‌ها — ${toPersianDigits(unreadCount)} خوانده‌نشده`
      : "اعلان‌ها";

  return (
    <Link
      href="/dashboard/notifications"
      aria-label={label}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:bg-white/10 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
    >
      <Bell className="size-4" aria-hidden />

      {unreadCount > 0 ? (
        <span
          aria-hidden
          className="absolute end-0.5 -top-0.5 min-w-4 rounded-full bg-brand px-1 text-center text-[10px] leading-4 font-bold text-brand-foreground tabular-nums"
        >
          {/* Past ninety-nine the number stops being information and starts
              being a wide badge — "۹۹+" says the same thing in less space. */}
          {unreadCount > 99 ? "۹۹+" : toPersianDigits(unreadCount)}
        </span>
      ) : null}
    </Link>
  );
}
