import { describe, expect, it } from "vitest";
import {
  AUDIENCE_LABEL,
  audienceKind,
  mergeRecipients,
  needsSeason,
  withoutAuthor,
} from "@/lib/services/announcement-audience";

describe("who an announcement is for", () => {
  it("reads a team announcement as a team announcement", () => {
    expect(audienceKind({ teamId: "t1" })).toBe("TEAM");
  });

  it("reads a school announcement as a school announcement", () => {
    expect(audienceKind({ schoolId: "s1" })).toBe("SCHOOL");
  });

  it("treats nothing chosen as the whole academy", () => {
    expect(audienceKind({})).toBe("ACADEMY");
    expect(audienceKind({ teamId: null, schoolId: null })).toBe("ACADEMY");
    expect(audienceKind({ teamId: undefined })).toBe("ACADEMY");
  });

  /**
   * The validation layer refuses both at once, so this is the second line of
   * defence — for a row written before that rule existed, or by a migration.
   * Erring narrow is the safe direction: too few recipients is a mistake
   * someone reports, too many cannot be taken back.
   */
  it("takes the narrower audience when a row somehow carries both", () => {
    expect(audienceKind({ teamId: "t1", schoolId: "s1" })).toBe("TEAM");
  });

  it("names every audience in Persian", () => {
    for (const kind of ["TEAM", "SCHOOL", "ACADEMY"] as const) {
      expect(AUDIENCE_LABEL[kind].length).toBeGreaterThan(0);
    }
  });
});

describe("which audiences need a season", () => {
  it("needs one for a team or a school, not for the academy", () => {
    // A squad only exists within a season; the academy exists regardless.
    expect(needsSeason("TEAM")).toBe(true);
    expect(needsSeason("SCHOOL")).toBe(true);
    expect(needsSeason("ACADEMY")).toBe(false);
  });
});

describe("merging recipients", () => {
  /** A guardian with two children in one squad must be told once. */
  it("tells nobody twice", () => {
    const merged = mergeRecipients(
      ["p1", "p2", "guardian"],
      ["p3", "guardian"],
      ["guardian"],
    );

    expect(merged).toHaveLength(4);
    expect(merged.filter((id) => id === "guardian")).toHaveLength(1);
  });

  it("copes with empty lists", () => {
    expect(mergeRecipients([], [])).toEqual([]);
    expect(mergeRecipients()).toEqual([]);
  });
});

describe("leaving the author out", () => {
  /**
   * The badge is a prompt to act. A prompt about your own action is noise, and
   * noise is how people learn to ignore a badge.
   */
  it("does not notify the person who wrote it", () => {
    expect(withoutAuthor(["a", "b", "author"], "author")).toEqual(["a", "b"]);
  });

  it("changes nothing when the author has no person record", () => {
    expect(withoutAuthor(["a", "b"], null)).toEqual(["a", "b"]);
    expect(withoutAuthor(["a", "b"], undefined)).toEqual(["a", "b"]);
  });

  it("returns a copy rather than the original array", () => {
    const original = ["a", "b"];
    expect(withoutAuthor(original, null)).not.toBe(original);
  });
});
