import { describe, expect, it } from "vitest";
import {
  EMPTY_SUMMARY,
  EMPTY_TOTALS,
  goalsPerAppearance,
  matchOutcome,
  summarisePlayerMatches,
  summariseResults,
  type ScoredMatch,
} from "@/lib/services/match-result";

const match = (
  goalsFor: number | null,
  goalsAgainst: number | null,
  status: ScoredMatch["status"] = "COMPLETED",
): ScoredMatch => ({ status, goalsFor, goalsAgainst });

describe("who won", () => {
  it("reads a completed score", () => {
    expect(matchOutcome(match(3, 1))).toBe("WIN");
    expect(matchOutcome(match(1, 3))).toBe("LOSS");
    expect(matchOutcome(match(2, 2))).toBe("DRAW");
    expect(matchOutcome(match(0, 0))).toBe("DRAW");
  });

  /**
   * Three situations, one answer: not played, called off, or nobody entered
   * the score. Reporting any of them as a draw would be a lie that looks
   * like data.
   */
  it("is null whenever the question does not apply", () => {
    expect(matchOutcome(match(null, null, "SCHEDULED"))).toBeNull();
    expect(matchOutcome(match(2, 1, "SCHEDULED"))).toBeNull();
    expect(matchOutcome(match(2, 1, "CANCELLED"))).toBeNull();
    expect(matchOutcome(match(2, 1, "POSTPONED"))).toBeNull();
    expect(matchOutcome(match(null, null, "COMPLETED"))).toBeNull();
    // Half a score is no score.
    expect(matchOutcome(match(2, null, "COMPLETED"))).toBeNull();
  });
});

describe("a team's record", () => {
  it("counts nothing from an empty season", () => {
    expect(summariseResults([])).toEqual(EMPTY_SUMMARY);
  });

  it("counts only matches that were played and scored", () => {
    const summary = summariseResults([
      match(3, 1),
      match(0, 2),
      match(1, 1),
      match(5, 0, "SCHEDULED"),
      match(4, 0, "CANCELLED"),
      match(null, null, "COMPLETED"),
    ]);

    expect(summary.played).toBe(3);
    expect(summary.won).toBe(1);
    expect(summary.drawn).toBe(1);
    expect(summary.lost).toBe(1);
    expect(summary.goalsFor).toBe(4);
    expect(summary.goalsAgainst).toBe(4);
    expect(summary.goalDifference).toBe(0);
  });

  it("reports a negative goal difference as such", () => {
    expect(summariseResults([match(0, 3), match(1, 2)]).goalDifference).toBe(
      -4,
    );
  });
});

describe("a player's season", () => {
  const row = (
    minutesPlayed: number,
    started = true,
    extra: Partial<{
      goals: number;
      assists: number;
      yellowCards: number;
      redCards: number;
    }> = {},
  ) => ({
    minutesPlayed,
    started,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    ...extra,
  });

  it("counts nothing from nothing", () => {
    expect(summarisePlayerMatches([])).toEqual(EMPTY_TOTALS);
  });

  /**
   * The rule worth a test: a named substitute who never came on is not an
   * appearance. Counting them would inflate everything later divided by it.
   */
  it("does not count a substitute who never came on", () => {
    const totals = summarisePlayerMatches([
      row(90, true, { goals: 1 }),
      row(0, false),
      row(20, false, { assists: 1 }),
    ]);

    expect(totals.appearances).toBe(2);
    expect(totals.starts).toBe(1);
    expect(totals.minutesPlayed).toBe(110);
    expect(totals.goals).toBe(1);
    expect(totals.assists).toBe(1);
  });

  it("still counts the cards of a player who came on and was sent off", () => {
    const totals = summarisePlayerMatches([
      row(5, false, { redCards: 1, yellowCards: 1 }),
    ]);

    expect(totals.appearances).toBe(1);
    expect(totals.redCards).toBe(1);
    expect(totals.yellowCards).toBe(1);
  });
});

describe("goals per appearance", () => {
  it("is null before a first appearance", () => {
    expect(goalsPerAppearance(EMPTY_TOTALS)).toBeNull();
  });

  it("divides by appearances, not by matches named in", () => {
    expect(
      goalsPerAppearance({ ...EMPTY_TOTALS, appearances: 4, goals: 6 }),
    ).toBe(1.5);
  });

  it("rounds to one decimal", () => {
    expect(
      goalsPerAppearance({ ...EMPTY_TOTALS, appearances: 3, goals: 2 }),
    ).toBe(0.7);
  });
});
