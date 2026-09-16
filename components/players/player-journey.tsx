import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  LogOut,
  Star,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/states/empty-state";
import { formatJalali } from "@/lib/utils/date";
import type { JourneyEventType } from "@/lib/generated/prisma/enums";

export interface JourneyEntry {
  id: string;
  type: JourneyEventType;
  title: string;
  description: string | null;
  occurredAt: Date;
  meta: { label: string; tone: "brand" | "success" | "muted" | "warning" };
}

const ICONS: Record<JourneyEventType, LucideIcon> = {
  REGISTERED: UserPlus,
  SCHOOL_JOINED: GraduationCap,
  TRYOUT_REGISTERED: ClipboardCheck,
  TRYOUT_ACCEPTED: Star,
  TRYOUT_REJECTED: XCircle,
  EVALUATION: ClipboardCheck,
  TEAM_JOINED: Users,
  TEAM_LEFT: LogOut,
  PROMOTED: TrendingUp,
  TRANSFERRED: CalendarCheck,
  ACHIEVEMENT: Award,
  OTHER: CalendarCheck,
};

const TONE: Record<JourneyEntry["meta"]["tone"], string> = {
  brand: "bg-brand text-brand-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
};

export interface PlayerJourneyProps {
  entries: readonly JourneyEntry[];
  className?: string;
}

/**
 * The player's path through the academy, newest first.
 *
 * Read-only by design: the timeline is a record of what happened, and each
 * entry was written in the same transaction as the fact it describes. A
 * correction is a new entry, never an edit.
 */
export function PlayerJourney({ entries, className }: PlayerJourneyProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="هنوز رویدادی ثبت نشده است"
        description="با ثبت‌نام، پیوستن به مدرسه یا تیم، مسیر بازیکن اینجا شکل می‌گیرد."
      />
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {entries.map((entry, index) => {
        const Icon = ICONS[entry.type];
        const isLast = index === entries.length - 1;

        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* The spine, drawn between markers rather than behind them. */}
            {isLast ? null : (
              <span
                aria-hidden="true"
                className="absolute start-[1.125rem] top-9 bottom-0 w-px bg-border"
              />
            )}

            <span
              aria-hidden="true"
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                TONE[entry.meta.tone],
              )}
            >
              <Icon className="size-4" />
            </span>

            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-medium">{entry.title}</p>
                <time
                  dateTime={entry.occurredAt.toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatJalali(entry.occurredAt)}
                </time>
              </div>
              {entry.description ? (
                <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                  {entry.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
