import {
  assertWithinScope,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  listJourneyForPlayer,
  type JourneyEventInput,
} from "@/lib/repositories/journey.repository";
import { appendJourneyEvent } from "@/lib/repositories/journey.repository";
import type { Db } from "@/lib/repositories/transaction";
import type { JourneyEventType } from "@/lib/generated/prisma/enums";

/**
 * The player's timeline.
 *
 * Events are recorded by the services that cause them, inside the same
 * transaction as the fact itself — see `recordJourneyEvent`. Nothing writes to
 * this timeline after the event, and nothing edits it.
 */

/** Persian label and tone for each kind of event, used by the timeline. */
export const JOURNEY_EVENT_META: Record<
  JourneyEventType,
  { label: string; tone: "brand" | "success" | "muted" | "warning" }
> = {
  REGISTERED: { label: "ثبت‌نام در آکادمی", tone: "brand" },
  SCHOOL_JOINED: { label: "پیوستن به مدرسه", tone: "success" },
  TRYOUT_REGISTERED: { label: "ثبت‌نام استعدادیابی", tone: "muted" },
  TRYOUT_ACCEPTED: { label: "پذیرش در استعدادیابی", tone: "success" },
  TRYOUT_REJECTED: { label: "عدم پذیرش", tone: "warning" },
  EVALUATION: { label: "ارزیابی", tone: "muted" },
  TEAM_JOINED: { label: "پیوستن به تیم", tone: "success" },
  TEAM_LEFT: { label: "جدایی از تیم", tone: "warning" },
  PROMOTED: { label: "ارتقا به رده بالاتر", tone: "brand" },
  TRANSFERRED: { label: "انتقال", tone: "muted" },
  ACHIEVEMENT: { label: "دستاورد", tone: "brand" },
  OTHER: { label: "رویداد", tone: "muted" },
};

/**
 * Records an event.
 *
 * Always called with the transaction of the write it describes. A timeline
 * that can disagree with the records it describes is worse than no timeline —
 * so this never runs on its own connection.
 */
export function recordJourneyEvent(
  input: JourneyEventInput,
  tx: Db,
): Promise<unknown> {
  return appendJourneyEvent(input, tx);
}

export async function getPlayerJourney(
  caller: AuthorizedUser,
  playerId: string,
) {
  requirePermission(caller, "player:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  const events = await listJourneyForPlayer(playerId);

  return events.map((event) => ({
    ...event,
    meta: JOURNEY_EVENT_META[event.type],
  }));
}
