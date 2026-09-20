import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/utils/number";
import type { DashboardAlert } from "@/lib/services/dashboard-metrics";

/**
 * What needs doing.
 *
 * Only non-zero alerts reach here — `buildAlerts` drops the rest — so an empty
 * list genuinely means nothing is outstanding, and says so once rather than
 * showing five cards reading «۰ مورد».
 *
 * Each row carries an icon as well as a colour, because a colour-blind reader
 * must be able to tell a warning from a note, and each links to the page where
 * the thing can actually be done. An alert with nowhere to go is a complaint.
 */
export function AlertList({ alerts }: { alerts: readonly DashboardAlert[] }) {
  if (alerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">موردی برای رسیدگی نیست.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {alerts.map((alert) => {
        const Icon = alert.tone === "WARNING" ? AlertTriangle : Info;

        return (
          <li key={alert.key}>
            <Link
              href={alert.href}
              className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent/40"
            >
              <Icon
                aria-hidden
                className={cn(
                  "size-4 shrink-0",
                  alert.tone === "WARNING"
                    ? "text-warning"
                    : "text-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1">{alert.title}</span>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
                  alert.tone === "WARNING"
                    ? "bg-warning text-warning-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {toPersianDigits(alert.count)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
