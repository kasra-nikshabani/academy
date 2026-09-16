import { describe, expect, it } from "vitest";
import {
  contains,
  durationMinutes,
  overlaps,
  sessionEnd,
} from "@/lib/services/training-time";

const at = (iso: string): Date => new Date(iso);

/** 16:00–17:30 Tehran on a Saturday. */
const base = {
  startsAt: at("2026-09-12T12:30:00.000Z"),
  endsAt: at("2026-09-12T14:00:00.000Z"),
};

describe("a session's end", () => {
  it("is the start plus the duration", () => {
    expect(sessionEnd(base.startsAt, 90).toISOString()).toBe(
      base.endsAt.toISOString(),
    );
  });

  it("reads back as the duration it was built from", () => {
    for (const minutes of [15, 45, 90, 105, 300]) {
      const span = {
        startsAt: base.startsAt,
        endsAt: sessionEnd(base.startsAt, minutes),
      };
      expect(durationMinutes(span)).toBe(minutes);
    }
  });

  it("crosses midnight without special handling", () => {
    const late = at("2026-09-12T20:00:00.000Z");
    expect(
      durationMinutes({ startsAt: late, endsAt: sessionEnd(late, 120) }),
    ).toBe(120);
  });
});

describe("two sessions overlapping", () => {
  it("is false when one ends exactly as the other starts", () => {
    // The case that decides whether the calendar is usable: U12 at 16:00–17:30
    // and U14 at 17:30–19:00 is an ordinary academy afternoon.
    const next = {
      startsAt: base.endsAt,
      endsAt: sessionEnd(base.endsAt, 90),
    };
    expect(overlaps(base, next)).toBe(false);
    expect(overlaps(next, base)).toBe(false);
  });

  it("is false when they are far apart", () => {
    const tomorrow = {
      startsAt: at("2026-09-13T12:30:00.000Z"),
      endsAt: at("2026-09-13T14:00:00.000Z"),
    };
    expect(overlaps(base, tomorrow)).toBe(false);
  });

  it("is true for a partial overlap from either side", () => {
    const later = {
      startsAt: at("2026-09-12T13:30:00.000Z"),
      endsAt: at("2026-09-12T15:00:00.000Z"),
    };
    expect(overlaps(base, later)).toBe(true);
    expect(overlaps(later, base)).toBe(true);
  });

  it("is true when one contains the other", () => {
    const inner = {
      startsAt: at("2026-09-12T13:00:00.000Z"),
      endsAt: at("2026-09-12T13:30:00.000Z"),
    };
    expect(overlaps(base, inner)).toBe(true);
    expect(overlaps(inner, base)).toBe(true);
  });

  it("is true for the identical span", () => {
    expect(overlaps(base, { ...base })).toBe(true);
  });
});

describe("an instant inside a session", () => {
  it("includes the start and excludes the end", () => {
    expect(contains(base, base.startsAt)).toBe(true);
    expect(contains(base, base.endsAt)).toBe(false);
    expect(contains(base, at("2026-09-12T13:00:00.000Z"))).toBe(true);
    expect(contains(base, at("2026-09-12T12:29:59.000Z"))).toBe(false);
  });
});
