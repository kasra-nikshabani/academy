import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

export interface ReportRange {
  teamIds: readonly string[] | null;
  seasonId?: string | undefined;
  teamId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

/** The team narrowing every report shares. */
function teamFilter(range: ReportRange) {
  if (range.teamId) return { teamId: range.teamId };
  // Narrowed inside the query; a post-filter leaks the totals
  // (docs/PERMISSIONS.md §2).
  return range.teamIds === null ? {} : { teamId: { in: [...range.teamIds] } };
}

function sessionWindow(range: ReportRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  const window: Prisma.DateTimeFilter = {};
  if (range.from) window.gte = range.from;
  if (range.to) window.lt = range.to;
  return window;
}

/**
 * Every attendance row in the window, with the player and session it belongs
 * to.
 *
 * One query rather than one per player: a term's register for a squad is a few
 * hundred rows, and the alternative is a round trip per name on a list whose
 * whole purpose is to have every name on it.
 *
 * **No national code, no mobile, no medical note.** This feeds a file that
 * leaves the building (CLAUDE.md §27); it carries the club's own player code,
 * which is what the club uses to talk about a player.
 */
export function listAttendanceRows(range: ReportRange) {
  const window = sessionWindow(range);

  return prisma.attendance.findMany({
    where: {
      trainingSession: {
        ...teamFilter(range),
        ...(range.seasonId ? { seasonId: range.seasonId } : {}),
        ...(window ? { startsAt: window } : {}),
      },
    },
    orderBy: [{ trainingSession: { startsAt: "asc" } }],
    select: {
      status: true,
      minutesLate: true,
      player: {
        select: {
          id: true,
          playerCode: true,
          person: { select: { firstName: true, lastName: true } },
        },
      },
      trainingSession: {
        select: {
          id: true,
          startsAt: true,
          type: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });
}

/** Matches in the window, for the results report. */
export function listMatchRows(range: ReportRange) {
  const window = sessionWindow(range);

  return prisma.match.findMany({
    where: {
      ...teamFilter(range),
      ...(range.seasonId ? { seasonId: range.seasonId } : {}),
      ...(window ? { kickoffAt: window } : {}),
    },
    orderBy: { kickoffAt: "asc" },
    select: {
      id: true,
      opponent: true,
      competition: true,
      homeAway: true,
      kickoffAt: true,
      status: true,
      goalsFor: true,
      goalsAgainst: true,
      team: { select: { id: true, name: true } },
      _count: { select: { lineup: true } },
    },
  });
}

/**
 * The squad, as a roster export.
 *
 * Deliberately thin: name, code, shirt number, position, team, joined. A
 * roster is passed around — to a referee, to a tournament organiser — and
 * everything not needed for that is a liability once it leaves.
 */
export function listRosterRows(range: ReportRange) {
  return prisma.teamMembership.findMany({
    where: {
      status: "ACTIVE",
      leftAt: null,
      ...teamFilter(range),
      ...(range.seasonId ? { seasonId: range.seasonId } : {}),
    },
    orderBy: [{ team: { name: "asc" } }, { jerseyNumber: "asc" }],
    select: {
      jerseyNumber: true,
      joinedAt: true,
      isPrimary: true,
      team: { select: { id: true, name: true } },
      season: { select: { name: true } },
      player: {
        select: {
          playerCode: true,
          position: true,
          status: true,
          person: {
            select: { firstName: true, lastName: true, dateOfBirth: true },
          },
        },
      },
    },
  });
}

/**
 * Trial applications in the window.
 *
 * Tryout applications carry a national code by necessity — the public form
 * requires one to avoid creating a duplicate player. It is **not** selected
 * here: an export of the talent pipeline is a management document, and a
 * national code in it is a leak waiting for an email forward.
 */
export function listApplicationRows(range: ReportRange) {
  const window = sessionWindow(range);

  return prisma.tryoutApplication.findMany({
    where: {
      ...(range.seasonId ? { tryout: { seasonId: range.seasonId } } : {}),
      ...(window ? { submittedAt: window } : {}),
    },
    orderBy: { submittedAt: "asc" },
    select: {
      trackingCode: true,
      status: true,
      submittedAt: true,
      decidedAt: true,
      decisionNote: true,
      tryout: { select: { title: true, ageGroup: { select: { code: true } } } },
      screening: { select: { status: true, checkedAt: true } },
      player: {
        select: {
          playerCode: true,
          person: { select: { firstName: true, lastName: true } },
        },
      },
      evaluations: {
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { overallScore: true, recommendation: true },
      },
    },
  });
}
