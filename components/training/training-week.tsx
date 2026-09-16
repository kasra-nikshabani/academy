import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_NAMES,
  addDays,
  formatJalaliLong,
  isSameJalaliDay,
  toJalali,
} from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import { TrainingCard, type TrainingCardSession } from "./training-card";

export interface TrainingWeekProps {
  /** Midnight Tehran on the Saturday the week opens. */
  weekStart: Date;
  sessions: readonly TrainingCardSession[];
  /** Marked as "today" when it falls inside the week. */
  today: Date;
  showTeam?: boolean;
}

/**
 * A week of training, Saturday to Friday.
 *
 * Seven columns on a desktop and a stack of days on a phone — the same markup
 * either way, because a coach checks tomorrow's session on a phone and plans
 * the week at a desk, and these should not be two different pages.
 *
 * Days with nothing on them are dropped from the phone layout: scrolling past
 * five empty cards to reach Monday is worse than not seeing Sunday at all.
 */
export function TrainingWeek({
  weekStart,
  sessions,
  today,
  showTeam = true,
}: TrainingWeekProps) {
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="این هفته جلسه‌ای ثبت نشده است"
        description="با هفته‌های دیگر یا فیلتر تیم، برنامه تمرین را مرور کنید."
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
      {days.map((day, index) => {
        const daySessions = sessions.filter((session) =>
          isSameJalaliDay(session.startsAt, day),
        );
        const isToday = isSameJalaliDay(day, today);
        const { jd } = toJalali(day);

        return (
          <section
            key={day.toISOString()}
            aria-label={formatJalaliLong(day)}
            className={cn(
              // The cards inside size themselves to this column.
              "@container rounded-lg border border-border p-2",
              isToday && "border-brand bg-brand-muted/40",
              // A day with nothing in it is only worth a column on a wide screen.
              daySessions.length === 0 && "hidden lg:block",
            )}
          >
            <h3 className="mb-2 flex items-baseline justify-between gap-2 px-1 text-xs">
              <span className={cn("font-medium", isToday && "text-foreground")}>
                {WEEKDAY_NAMES[index]}
              </span>
              <span className="text-muted-foreground">
                {toPersianDigits(jd)}
              </span>
            </h3>

            {daySessions.length === 0 ? (
              <p className="px-1 pb-2 text-xs text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {daySessions.map((session) => (
                  <li key={session.id}>
                    <TrainingCard session={session} showTeam={showTeam} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
