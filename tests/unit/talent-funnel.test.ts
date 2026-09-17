import { describe, expect, it } from "vitest";
import {
  EMPTY_COUNTS,
  acceptedWithoutEvaluation,
  conversionRate,
  funnelStages,
  stillOpen,
  type PipelineCounts,
} from "@/lib/services/talent-funnel";

const counts = (overrides: Partial<PipelineCounts>): PipelineCounts => ({
  ...EMPTY_COUNTS,
  ...overrides,
});

describe("the funnel stages", () => {
  it("measures every share against the applications, not the stage before", () => {
    const stages = funnelStages(
      counts({ applied: 100, passedScreening: 60, evaluated: 40, accepted: 10 }),
    );

    expect(stages.map((stage) => stage.share)).toEqual([100, 60, 40, 10]);
  });

  it("reports what was lost between one stage and the next", () => {
    const stages = funnelStages(
      counts({ applied: 100, passedScreening: 60, evaluated: 40, accepted: 10 }),
    );

    expect(stages.map((stage) => stage.droppedFromPrevious)).toEqual([
      null,
      40,
      20,
      30,
    ]);
  });

  /**
   * A manager may watch a trial themselves and take a player nobody filed an
   * evaluation for. The funnel reports that rather than reshaping itself to
   * slope downward — and "−۲ lost" would be nonsense, so the drop is null.
   */
  it("does not invent a loss when a later stage is larger", () => {
    const stages = funnelStages(
      counts({ applied: 10, passedScreening: 8, evaluated: 3, accepted: 5 }),
    );

    expect(stages[3]!.value).toBe(5);
    expect(stages[3]!.droppedFromPrevious).toBeNull();
    // And the share is still measured against the applications.
    expect(stages[3]!.share).toBe(50);
  });

  it("survives an empty pipeline without dividing by zero", () => {
    const stages = funnelStages(EMPTY_COUNTS);
    expect(stages.every((stage) => stage.share === 0)).toBe(true);
  });
});

describe("the conversion rate", () => {
  it("is null before anyone has applied", () => {
    expect(conversionRate(EMPTY_COUNTS)).toBeNull();
  });

  it("is the share of applications that became players", () => {
    expect(conversionRate(counts({ applied: 50, accepted: 7 }))).toBe(14);
  });

  it("is zero, not null, when nobody was taken", () => {
    expect(conversionRate(counts({ applied: 50, accepted: 0 }))).toBe(0);
  });
});

describe("applications still moving", () => {
  /**
   * The reason this number is on the page next to the conversion rate: a trial
   * that closed yesterday looks like a disaster until the decisions are made.
   */
  it("counts everyone nobody has decided about", () => {
    expect(
      stillOpen(
        counts({
          applied: 100,
          accepted: 10,
          rejectedAtScreening: 20,
          rejectedAfterScreening: 15,
          waitlisted: 5,
          cancelled: 2,
        }),
      ),
    ).toBe(48);
  });

  it("is zero once every application has an answer", () => {
    expect(
      stillOpen(counts({ applied: 3, accepted: 1, rejectedAtScreening: 2 })),
    ).toBe(0);
  });
});

describe("accepted without an evaluation", () => {
  it("is the gap between acceptances and evaluated acceptances", () => {
    expect(acceptedWithoutEvaluation(10, 7)).toBe(3);
  });

  it("never goes negative", () => {
    expect(acceptedWithoutEvaluation(5, 9)).toBe(0);
  });
});
