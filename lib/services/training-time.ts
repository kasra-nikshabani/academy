/**
 * When a session runs, and whether two of them collide.
 *
 * Pure functions with no database and no Prisma, so the rule that decides a
 * clash can be tested exhaustively — including the boundary case that matters
 * most: a session ending exactly when the next one starts is **not** a clash.
 * A back-to-back U12 and U14 session on the same pitch is the normal shape of
 * an academy afternoon, and refusing it would make the calendar unusable.
 */

export interface TimeSpan {
  startsAt: Date;
  endsAt: Date;
}

const MINUTE_MS = 60 * 1000;

/** The end of a session that starts at `startsAt` and runs `minutes`. */
export function sessionEnd(startsAt: Date, minutes: number): Date {
  return new Date(startsAt.getTime() + minutes * MINUTE_MS);
}

/** Whole minutes between the two ends of a span. */
export function durationMinutes(span: TimeSpan): number {
  return Math.round(
    (span.endsAt.getTime() - span.startsAt.getTime()) / MINUTE_MS,
  );
}

/**
 * Do the two spans share any time at all?
 *
 * Half-open intervals: `[start, end)`. Touching ends do not overlap.
 */
export function overlaps(a: TimeSpan, b: TimeSpan): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** Is the instant inside the span? Same half-open convention. */
export function contains(span: TimeSpan, instant: Date): boolean {
  return span.startsAt <= instant && instant < span.endsAt;
}
