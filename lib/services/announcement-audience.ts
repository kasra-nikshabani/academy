/**
 * Who an announcement is for.
 *
 * Pure, so the rule can be checked without a database — and it is a rule worth
 * checking, because getting it wrong means either a parent never hears that
 * training moved, or every family in the academy hears about one squad's
 * change of kit.
 */

export type AudienceKind = "TEAM" | "SCHOOL" | "ACADEMY";

export interface AudienceTarget {
  teamId?: string | null | undefined;
  schoolId?: string | null | undefined;
}

/**
 * Narrowest wins.
 *
 * A message carrying both a team and a school is about the team — the team is
 * the smaller group, and a writer who picked both meant the one they picked
 * last. Rather than guess which that was, the narrower reading is taken: an
 * announcement that reaches too few people is a mistake someone notices and
 * corrects, and one that reaches too many cannot be taken back.
 */
export function audienceKind(target: AudienceTarget): AudienceKind {
  if (target.teamId) return "TEAM";
  if (target.schoolId) return "SCHOOL";
  return "ACADEMY";
}

export const AUDIENCE_LABEL: Record<AudienceKind, string> = {
  TEAM: "تیم",
  SCHOOL: "مدرسه",
  ACADEMY: "کل آکادمی",
};

/** Whether this audience needs a season to resolve the people in it. */
export function needsSeason(kind: AudienceKind): boolean {
  return kind !== "ACADEMY";
}

/**
 * Folds several person-id lists into one, without duplicates.
 *
 * A guardian with two children in the same squad must be told once. Left to
 * the database, the duplicate is a second row in the same inbox saying exactly
 * the same thing — which reads as a bug, because it is one.
 */
export function mergeRecipients(
  ...lists: readonly (readonly string[])[]
): string[] {
  return [...new Set(lists.flat())];
}

/**
 * Removes the author from their own announcement.
 *
 * A coach who tells the squad training moved does not need telling. The unread
 * badge is a prompt to act, and a prompt about your own action is noise that
 * teaches people to ignore the badge.
 */
export function withoutAuthor(
  personIds: readonly string[],
  authorPersonId: string | null | undefined,
): string[] {
  if (!authorPersonId) return [...personIds];
  return personIds.filter((id) => id !== authorPersonId);
}
