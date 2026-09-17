import { z } from "zod";
import { idSchema } from "./common";

/**
 * Matches, team sheets and statistics.
 *
 * A fixture is given a kick-off and a duration rather than a start and an end,
 * for the same reason a training session is: that is how a coach thinks about
 * it, and it cannot be entered backwards.
 */

export const MATCH_STATUSES = [
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "POSTPONED",
  "CANCELLED",
] as const;

export const HOME_AWAY = ["HOME", "AWAY", "NEUTRAL"] as const;
export const LINEUP_ROLES = ["STARTER", "SUBSTITUTE"] as const;

/** Youth matches are short; a full senior game plus stoppage is the ceiling. */
const MIN_MATCH_MINUTES = 20;
const MAX_MATCH_MINUTES = 150;

export const createMatchSchema = z.object({
  teamId: idSchema,
  opponent: z.string().trim().min(2, "نام حریف را بنویسید.").max(160),
  competition: z.string().trim().max(120).optional(),
  homeAway: z.enum(HOME_AWAY).default("HOME"),
  venue: z.string().trim().max(200).optional(),
  kickoffAt: z.coerce.date(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(MIN_MATCH_MINUTES)
    .max(MAX_MATCH_MINUTES)
    .default(90),
  /** A fixture is put on the calendar or drafted; it is not born finished. */
  status: z.enum(["SCHEDULED", "LIVE"]).default("SCHEDULED"),
  notes: z.string().trim().max(2000).optional(),
});

export const updateMatchSchema = z
  .object({
    opponent: z.string().trim().min(2).max(160).optional(),
    competition: z.string().trim().max(120).nullable().optional(),
    homeAway: z.enum(HOME_AWAY).optional(),
    venue: z.string().trim().max(200).nullable().optional(),
    kickoffAt: z.coerce.date().optional(),
    durationMinutes: z.coerce
      .number()
      .int()
      .min(MIN_MATCH_MINUTES)
      .max(MAX_MATCH_MINUTES)
      .optional(),
    status: z.enum(["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"]).optional(),
    goalsFor: z.coerce.number().int().min(0).max(99).nullable().optional(),
    goalsAgainst: z.coerce.number().int().min(0).max(99).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "هیچ تغییری ارسال نشده است.",
  });

export const cancelMatchSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  /** Called off for now, or called off for good. */
  status: z.enum(["CANCELLED", "POSTPONED"]).default("CANCELLED"),
});

export const matchQuerySchema = z.object({
  teamId: idSchema.optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// --- the team sheet ---------------------------------------------------------

export const lineupEntrySchema = z.object({
  playerId: idSchema,
  role: z.enum(LINEUP_ROLES).default("STARTER"),
  shirtNumber: z.coerce.number().int().min(1).max(99).optional(),
  position: z.string().trim().max(60).optional(),
});

/**
 * The whole sheet in one request.
 *
 * `PUT` semantics: what is sent **is** the lineup. A player left out of the
 * list is left out of the squad, which is what a coach means when they redraw
 * a team sheet — sending only additions would make removing someone
 * impossible without a second endpoint nobody would remember to call.
 */
export const saveLineupSchema = z.object({
  entries: z.array(lineupEntrySchema).max(30),
});

// --- statistics -------------------------------------------------------------

export const matchStatSchema = z.object({
  playerId: idSchema,
  minutesPlayed: z.coerce.number().int().min(0).max(MAX_MATCH_MINUTES).default(0),
  goals: z.coerce.number().int().min(0).max(30).default(0),
  assists: z.coerce.number().int().min(0).max(30).default(0),
  yellowCards: z.coerce.number().int().min(0).max(2).default(0),
  redCards: z.coerce.number().int().min(0).max(1).default(0),
  notes: z.string().trim().max(400).optional(),
});

export const saveStatsSchema = z
  .object({ entries: z.array(matchStatSchema).max(30) })
  .refine(
    (input) =>
      new Set(input.entries.map((entry) => entry.playerId)).size ===
      input.entries.length,
    { message: "برای هر بازیکن فقط یک ردیف آمار قابل ثبت است." },
  );

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type MatchQuery = z.infer<typeof matchQuerySchema>;
export type SaveLineupInput = z.infer<typeof saveLineupSchema>;
export type SaveStatsInput = z.infer<typeof saveStatsSchema>;
