import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  formatJalaliLong,
  formatTime,
  formatTimeRange,
} from "@/lib/utils/date";
import { TRAINING_STATUS_LABEL, TRAINING_TYPE_LABEL } from "./training-meta";
import type {
  TrainingStatus,
  TrainingType,
} from "@/lib/generated/prisma/enums";

export interface TrainingCardSession {
  id: string;
  startsAt: Date;
  endsAt: Date;
  type: TrainingType;
  status: TrainingStatus;
  location: string | null;
  team: { id: string; name: string };
  plan?: { id: string; title: string } | null;
}

export interface TrainingCardProps {
  session: TrainingCardSession;
  /** Hidden in a single-team view, where repeating the name is noise. */
  showTeam?: boolean;
  className?: string;
}

/** The accent strip down the leading edge, by status. */
const EDGE: Record<TrainingStatus, string> = {
  DRAFT: "before:bg-border",
  SCHEDULED: "before:bg-brand",
  COMPLETED: "before:bg-success",
  CANCELLED: "before:bg-warning",
};

const DOT: Record<TrainingStatus, string> = {
  DRAFT: "bg-muted-foreground/40",
  SCHEDULED: "bg-brand",
  COMPLETED: "bg-success",
  CANCELLED: "bg-warning",
};

/**
 * One session in the week grid.
 *
 * Deliberately terse. A column of the week is about ninety pixels wide on a
 * laptop, and the first draft put the time range, a status badge, the location
 * and the plan title in there — the range wrapped onto three lines and the
 * badge was clipped to «برگز». What a coach scans a week for is *when* and
 * *which squad*; everything else is one click away on the session page, and
 * is carried here by the link's accessible name and its tooltip.
 *
 * The whole card is the link rather than a button in the corner: on a phone,
 * at the side of a pitch, the target should be the size of the card.
 */
export function TrainingCard({
  session,
  showTeam = true,
  className,
}: TrainingCardProps) {
  const cancelled = session.status === "CANCELLED";
  const range = formatTimeRange(session.startsAt, session.endsAt);

  const description = [
    formatJalaliLong(session.startsAt),
    range,
    session.team.name,
    TRAINING_TYPE_LABEL[session.type],
    TRAINING_STATUS_LABEL[session.status],
    session.location,
  ]
    .filter(Boolean)
    .join("، ");

  return (
    <Link
      href={`/dashboard/training/sessions/${session.id}`}
      aria-label={description}
      title={description}
      className={cn(
        "relative block overflow-hidden rounded-lg bg-card p-2 ps-3 text-start ring-1 ring-foreground/10 transition-colors",
        "before:absolute before:inset-y-0 before:start-0 before:w-1",
        "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
        EDGE[session.status],
        cancelled && "opacity-75",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        {/*
          The end time and the location appear only when the card is actually
          wide enough for them — a container query, not a breakpoint, because
          the same card is a 90px column on a laptop and a full-width row on a
          phone at the very same viewport width.
        */}
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            cancelled && "line-through decoration-1",
          )}
        >
          <bdi dir="ltr">{formatTime(session.startsAt)}</bdi>
          <span className="hidden font-normal text-muted-foreground @[11rem]:inline">
            {" تا "}
            <bdi dir="ltr">{formatTime(session.endsAt)}</bdi>
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", DOT[session.status])}
        />
      </div>

      {showTeam ? (
        <p className="mt-1 text-xs leading-5 font-medium">
          {session.team.name}
        </p>
      ) : null}

      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
        {TRAINING_TYPE_LABEL[session.type]} ·{" "}
        {TRAINING_STATUS_LABEL[session.status]}
      </p>

      {session.location ? (
        <p className="mt-0.5 hidden text-[11px] leading-4 text-muted-foreground @[11rem]:block">
          {session.location}
        </p>
      ) : null}
    </Link>
  );
}
