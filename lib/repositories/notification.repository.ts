import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { NotificationType } from "@/lib/generated/prisma/enums";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  link: true,
  readAt: true,
  announcementId: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export async function listForPerson(params: {
  personId: string;
  unreadOnly?: boolean | undefined;
  skip: number;
  take: number;
}) {
  const where: Prisma.NotificationWhereInput = {
    personId: params.personId,
    ...(params.unreadOnly ? { readAt: null } : {}),
  };

  // Paired, not transactional — see the note in ./transaction.ts.
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      select: NOTIFICATION_SELECT,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total };
}

export function countUnread(personId: string): Promise<number> {
  return prisma.notification.count({ where: { personId, readAt: null } });
}

export function findNotificationById(id: string) {
  return prisma.notification.findUnique({
    where: { id },
    select: { ...NOTIFICATION_SELECT, personId: true },
  });
}

export interface NotificationDraft {
  personId: string;
  type: NotificationType;
  title: string;
  body?: string | undefined;
  link?: string | undefined;
  announcementId?: string | undefined;
  actorId?: string | undefined;
}

/**
 * Writes many notifications at once.
 *
 * `createMany` rather than a loop: publishing to a squad is one statement, and
 * inside a transaction a loop of fifty inserts holds the connection fifty
 * times as long. Returns the count actually written.
 */
export async function createNotifications(
  drafts: readonly NotificationDraft[],
  tx?: Db,
): Promise<number> {
  if (drafts.length === 0) return 0;

  const { count } = await dbOr(tx).notification.createMany({
    data: drafts.map((draft) => ({
      personId: draft.personId,
      type: draft.type,
      title: draft.title,
      ...(draft.body === undefined ? {} : { body: draft.body }),
      ...(draft.link === undefined ? {} : { link: draft.link }),
      ...(draft.announcementId === undefined
        ? {}
        : { announcementId: draft.announcementId }),
      ...(draft.actorId === undefined ? {} : { actorId: draft.actorId }),
    })),
  });

  return count;
}

/**
 * Marks one notification read, but only if it belongs to this person.
 *
 * The ownership check is in the `where`, not a separate read: `updateMany`
 * with a non-matching filter changes nothing and says so, which is both the
 * authorization and the answer in one round trip. A read-then-write here would
 * be a race with no upside.
 *
 * Already-read notifications are left alone so `readAt` keeps saying when it
 * was *first* seen.
 */
export async function markRead(
  id: string,
  personId: string,
  readAt: Date,
): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({
    where: { id, personId, readAt: null },
    data: { readAt },
  });
  return count > 0;
}

export async function markAllRead(
  personId: string,
  readAt: Date,
): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { personId, readAt: null },
    data: { readAt },
  });
  return count;
}

// --- the people an announcement reaches -------------------------------------

/**
 * Everyone in the academy who could read a notification.
 *
 * Players, their guardians, and staff. Deliberately **not** every `Person`
 * row: a person who is none of those three is a record with no relationship to
 * the club — a guardian's second contact, say — and a message addressed to
 * them reaches nobody.
 */
export async function findAllAudiencePersonIds(): Promise<string[]> {
  const rows = await prisma.person.findMany({
    where: {
      OR: [
        { player: { isNot: null } },
        { guardian: { isNot: null } },
        { staff: { isNot: null } },
      ],
    },
    select: { id: true },
  });

  return rows.map((row) => row.id);
}

/** The person rows behind a set of players, plus their guardians'. */
export async function findPersonIdsForPlayers(
  playerIds: readonly string[],
): Promise<string[]> {
  if (playerIds.length === 0) return [];

  const [players, guardianLinks] = await Promise.all([
    prisma.player.findMany({
      where: { id: { in: [...playerIds] } },
      select: { personId: true },
    }),
    prisma.playerGuardian.findMany({
      where: { playerId: { in: [...playerIds] } },
      select: { guardian: { select: { personId: true } } },
    }),
  ]);

  return [
    ...new Set([
      ...players.map((row) => row.personId),
      ...guardianLinks.map((row) => row.guardian.personId),
    ]),
  ];
}

/** Players enrolled at a school in a season. */
export async function findPlayerIdsInSchool(
  schoolId: string,
  seasonId: string,
): Promise<string[]> {
  const rows = await prisma.schoolEnrollment.findMany({
    where: { schoolId, seasonId, status: "ACTIVE" },
    select: { playerId: true },
  });

  return [...new Set(rows.map((row) => row.playerId))];
}

/** The staff assigned to a team — a team announcement is theirs too. */
export async function findStaffPersonIdsForTeam(
  teamId: string,
): Promise<string[]> {
  const rows = await prisma.staffTeam.findMany({
    where: { teamId },
    select: { staff: { select: { personId: true } } },
  });

  return [...new Set(rows.map((row) => row.staff.personId))];
}

// --- announcements ----------------------------------------------------------

const ANNOUNCEMENT_INCLUDE = {
  team: { select: { id: true, name: true } },
  school: { select: { id: true, name: true } },
  season: { select: { id: true, name: true } },
} satisfies Prisma.AnnouncementInclude;

export async function listAnnouncements(params: {
  status?: string | undefined;
  skip: number;
  take: number;
}) {
  const where: Prisma.AnnouncementWhereInput = {
    ...(params.status ? { status: params.status as never } : {}),
  };

  // Paired, not transactional — see the note in ./transaction.ts.
  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: ANNOUNCEMENT_INCLUDE,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: params.skip,
      take: params.take,
    }),
    prisma.announcement.count({ where }),
  ]);

  return { items, total };
}

export function findAnnouncementById(id: string) {
  return prisma.announcement.findUnique({
    where: { id },
    include: ANNOUNCEMENT_INCLUDE,
  });
}

export function createAnnouncement(
  data: {
    title: string;
    body: string;
    type: NotificationType;
    teamId?: string | undefined;
    schoolId?: string | undefined;
    seasonId?: string | undefined;
    authorId?: string | undefined;
  },
  tx?: Db,
) {
  // Created bare, then re-read with relations by the caller. A `create`
  // carrying an `include` over several relations compiles to a multi-statement
  // plan, which Prisma wraps in an implicit transaction — and inside one the
  // pg adapter issues the later statements on a client that is still busy.
  // Same finding, same fix, as Phase 11 (docs/DATABASE.md §7).
  return dbOr(tx).announcement.create({
    data: {
      title: data.title,
      body: data.body,
      type: data.type,
      ...(data.teamId === undefined ? {} : { teamId: data.teamId }),
      ...(data.schoolId === undefined ? {} : { schoolId: data.schoolId }),
      ...(data.seasonId === undefined ? {} : { seasonId: data.seasonId }),
      ...(data.authorId === undefined ? {} : { authorId: data.authorId }),
    },
    select: { id: true },
  });
}

export function updateAnnouncement(
  id: string,
  data: Prisma.AnnouncementUpdateInput,
  tx?: Db,
) {
  return dbOr(tx).announcement.update({
    where: { id },
    data,
    include: ANNOUNCEMENT_INCLUDE,
  });
}

/**
 * Moves a draft to published, and refuses if it already is.
 *
 * The status is in the `where`, so two people pressing publish at the same
 * moment produce one fan-out and one failure rather than two sets of
 * notifications — the same trick as `markRead`, for the same reason.
 */
export async function claimForPublishing(
  id: string,
  tx?: Db,
): Promise<boolean> {
  const { count } = await dbOr(tx).announcement.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  return count > 0;
}

/**
 * Records how many people the announcement reached.
 *
 * `updateMany`, not `update`. An `update` carrying a `select` compiles to two
 * statements, and inside a transaction the pg adapter issues the second on a
 * client that is still busy — `pg` 8 deprecates that and `pg` 9 will reject
 * it. Nothing here needs the row back; the caller re-reads it after the
 * commit (docs/DATABASE.md §7).
 */
export async function setRecipientCount(
  id: string,
  recipients: number,
  tx?: Db,
): Promise<void> {
  await dbOr(tx).announcement.updateMany({
    where: { id },
    data: { recipients },
  });
}

export function deleteDraft(id: string) {
  return prisma.announcement.deleteMany({ where: { id, status: "DRAFT" } });
}
