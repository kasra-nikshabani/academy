import type { MatchStatus } from "@/lib/generated/prisma/enums";

/**
 * Reading a result.
 *
 * Pure, because these are the numbers that end up on a player's record and in
 * a conversation with a parent, and they should be checkable without a
 * database.
 */

export type MatchOutcome = "WIN" | "DRAW" | "LOSS";

export interface ScoredMatch {
  status: MatchStatus;
  goalsFor: number | null;
  goalsAgainst: number | null;
}

/**
 * Who won, or null when the question does not apply yet.
 *
 * Null covers three different situations that all mean "do not draw a result
 * here": the match has not been played, it was called off, or nobody has
 * entered the score. Reporting any of them as a draw would be a lie that
 * looks like data.
 */
export function matchOutcome(match: ScoredMatch): MatchOutcome | null {
  if (match.status !== "COMPLETED") return null;
  if (match.goalsFor === null || match.goalsAgainst === null) return null;

  if (match.goalsFor > match.goalsAgainst) return "WIN";
  if (match.goalsFor < match.goalsAgainst) return "LOSS";
  return "DRAW";
}

export interface ResultSummary {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export const EMPTY_SUMMARY: ResultSummary = {
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
};

/**
 * A team's record over a set of matches.
 *
 * Only completed matches with a score count. **No points column**: three for a
 * win is a league's rule, not football's, and a youth academy plays friendlies
 * and tournaments under several different ones. A table that invented points
 * would be wrong somewhere.
 */
export function summariseResults(
  matches: readonly ScoredMatch[],
): ResultSummary {
  const summary = { ...EMPTY_SUMMARY };

  for (const match of matches) {
    const outcome = matchOutcome(match);
    if (outcome === null) continue;

    summary.played += 1;
    summary.goalsFor += match.goalsFor ?? 0;
    summary.goalsAgainst += match.goalsAgainst ?? 0;

    if (outcome === "WIN") summary.won += 1;
    else if (outcome === "DRAW") summary.drawn += 1;
    else summary.lost += 1;
  }

  summary.goalDifference = summary.goalsFor - summary.goalsAgainst;
  return summary;
}

export interface PlayerMatchTotals {
  appearances: number;
  starts: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export const EMPTY_TOTALS: PlayerMatchTotals = {
  appearances: 0,
  starts: 0,
  minutesPlayed: 0,
  goals: 0,
  assists: 0,
  yellowCards: 0,
  redCards: 0,
};

/**
 * A player's season.
 *
 * **An appearance means minutes on the pitch.** A named substitute who never
 * came on has a stat row of zeros, and counting that as an appearance would
 * inflate every figure that is later divided by it — goals per game most of
 * all.
 */
export function summarisePlayerMatches(
  rows: readonly {
    minutesPlayed: number;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    started: boolean;
  }[],
): PlayerMatchTotals {
  const totals = { ...EMPTY_TOTALS };

  for (const row of rows) {
    if (row.minutesPlayed > 0) {
      totals.appearances += 1;
      if (row.started) totals.starts += 1;
    }
    totals.minutesPlayed += row.minutesPlayed;
    totals.goals += row.goals;
    totals.assists += row.assists;
    totals.yellowCards += row.yellowCards;
    totals.redCards += row.redCards;
  }

  return totals;
}

/** Goals per appearance, to one decimal, or null with nothing to divide by. */
export function goalsPerAppearance(
  totals: PlayerMatchTotals,
): number | null {
  if (totals.appearances === 0) return null;
  return Math.round((totals.goals / totals.appearances) * 10) / 10;
}
