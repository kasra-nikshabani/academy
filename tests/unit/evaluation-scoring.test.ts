import { describe, expect, it } from "vitest";
import {
  dimensionAverages,
  isScoreInRange,
  weightedOverall,
  type ScoredCriterion,
} from "@/lib/services/evaluation-scoring";

const criterion = (
  score: number,
  maxScore = 10,
  weight = 1,
  dimension: ScoredCriterion["dimension"] = "TECHNICAL",
): ScoredCriterion => ({ score, maxScore, weight, dimension });

describe("the overall score", () => {
  it("is null when nothing has been marked", () => {
    expect(weightedOverall([])).toBeNull();
  });

  /** Null, not zero: an unmarked player has not scored zero. */
  it("is null rather than zero when every weight is zero", () => {
    expect(weightedOverall([criterion(8, 10, 0)])).toBeNull();
  });

  it("averages equal weights", () => {
    expect(weightedOverall([criterion(8), criterion(6)])).toBe(7);
  });

  it("respects weights", () => {
    // 9 counted twice and 6 once → (9+9+6)/3
    expect(weightedOverall([criterion(9, 10, 2), criterion(6, 10, 1)])).toBe(8);
  });

  /**
   * The reason each criterion is normalised before weighting: a template that
   * marks one thing out of five and another out of ten must not make the
   * first silently worth half as much.
   */
  it("normalises each criterion to its own maximum", () => {
    // Full marks on both, on different scales, is still a ten.
    expect(weightedOverall([criterion(5, 5), criterion(10, 10)])).toBe(10);
    // Half marks on both is a five.
    expect(weightedOverall([criterion(2.5, 5), criterion(5, 10)])).toBe(5);
  });

  it("always lands on a 0–10 scale, whatever the template", () => {
    expect(weightedOverall([criterion(100, 100)])).toBe(10);
    expect(weightedOverall([criterion(0, 100)])).toBe(0);
    expect(weightedOverall([criterion(50, 100)])).toBe(5);
  });

  it("rounds to one decimal, not to a false precision", () => {
    // (7 + 8 + 8) / 3 = 7.666…
    expect(weightedOverall([criterion(7), criterion(8), criterion(8)])).toBe(
      7.7,
    );
  });

  it("ignores a criterion with a nonsensical maximum", () => {
    expect(weightedOverall([criterion(8), criterion(5, 0)])).toBe(8);
  });
});

describe("the four dimensions", () => {
  it("averages each one on its own", () => {
    const averages = dimensionAverages([
      criterion(8, 10, 1, "TECHNICAL"),
      criterion(6, 10, 1, "TECHNICAL"),
      criterion(9, 10, 1, "PHYSICAL"),
    ]);

    expect(averages).toEqual({ TECHNICAL: 7, PHYSICAL: 9 });
  });

  /** Absent, not zero — the page must not imply a player was marked badly. */
  it("leaves out a dimension nobody scored", () => {
    const averages = dimensionAverages([criterion(8, 10, 1, "MENTAL")]);
    expect(averages).toEqual({ MENTAL: 8 });
    expect(averages.TECHNICAL).toBeUndefined();
  });

  it("returns nothing at all for an empty sheet", () => {
    expect(dimensionAverages([])).toEqual({});
  });
});

describe("a mark a criterion accepts", () => {
  it("is a whole number within range", () => {
    expect(isScoreInRange(0, 10)).toBe(true);
    expect(isScoreInRange(10, 10)).toBe(true);
    expect(isScoreInRange(11, 10)).toBe(false);
    expect(isScoreInRange(-1, 10)).toBe(false);
    expect(isScoreInRange(7.5, 10)).toBe(false);
  });
});
