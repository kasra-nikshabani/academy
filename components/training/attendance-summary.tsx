import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { cn } from "@/lib/utils";
import { formatJalali, formatTime } from "@/lib/utils/date";
import { toPersianDigits } from "@/lib/utils/number";
import {
  ATTENDANCE_STATUS_CLASS,
  ATTENDANCE_STATUS_LABEL,
} from "./training-meta";
import type { AttendanceTotals } from "@/lib/services/attendance-summary";
import type { AttendanceStatus } from "@/lib/generated/prisma/enums";

export interface AttendanceSummaryEntry {
  id: string;
  status: AttendanceStatus;
  minutesLate: number | null;
  trainingSession: {
    id: string;
    startsAt: Date;
    team: { id: string; name: string };
  };
}

export interface AttendanceSummaryProps {
  totals: AttendanceTotals;
  /** Null when nothing counts yet — no sessions, or only excused ones. */
  rate: number | null;
  entries: readonly AttendanceSummaryEntry[];
  className?: string;
}

/**
 * A player's attendance: the rate, the counts, and the recent sessions.
 *
 * The rate deliberately leaves excused absences out of the sum — a rest week
 * the club agreed to is not a discipline figure (lib/services/attendance-summary.ts).
 * The count is still shown, because leaving it off the page would look like
 * those sessions never happened.
 */
export function AttendanceSummary({
  totals,
  rate,
  entries,
  className,
}: AttendanceSummaryProps) {
  if (totals.total === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="هنوز حضور و غیابی ثبت نشده است"
        description="پس از برگزاری اولین جلسه تمرین، حضور بازیکن اینجا دیده می‌شود."
      />
    );
  }

  const counts: ReadonlyArray<[AttendanceStatus, number]> = [
    ["PRESENT", totals.present],
    ["LATE", totals.late],
    ["ABSENT", totals.absent],
    ["EXCUSED", totals.excused],
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {rate === null ? "—" : `${toPersianDigits(rate)}٪`}
          </p>
          <p className="text-xs text-muted-foreground">نرخ حضور</p>
        </div>

        <dl className="flex flex-wrap gap-2">
          {counts.map(([status, count]) => (
            <div
              key={status}
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                // A red «غایب ۰» reads as a problem. A count of zero is the
                // absence of the thing, so it is shown without its colour.
                count === 0
                  ? "bg-muted/60 text-muted-foreground"
                  : ATTENDANCE_STATUS_CLASS[status],
              )}
            >
              <dt className="inline">{ATTENDANCE_STATUS_LABEL[status]}</dt>{" "}
              <dd className="inline font-medium tabular-nums">
                {toPersianDigits(count)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {entries.slice(0, 8).map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span>
              {formatJalali(entry.trainingSession.startsAt)}
              <span className="ms-2 text-xs text-muted-foreground">
                <bdi dir="ltr">
                  {formatTime(entry.trainingSession.startsAt)}
                </bdi>
                {" · "}
                {entry.trainingSession.team.name}
              </span>
            </span>

            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs",
                ATTENDANCE_STATUS_CLASS[entry.status],
              )}
            >
              {ATTENDANCE_STATUS_LABEL[entry.status]}
              {entry.status === "LATE" && entry.minutesLate
                ? ` · ${toPersianDigits(entry.minutesLate)} دقیقه`
                : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
