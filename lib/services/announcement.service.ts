import { buildPaginationMeta, type PaginationQuery } from "@/lib/api";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasPermission,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import {
  findActiveSeason,
  findSchoolById,
  findTeamById,
} from "@/lib/repositories/academy.repository";
import { findPlayerIdsInTeams } from "@/lib/repositories/enrollment.repository";
import { findPersonIdForUser } from "@/lib/repositories/people.repository";
import * as repo from "@/lib/repositories/notification.repository";
import { runInTransaction, type Db } from "@/lib/repositories/transaction";
import type {
  AnnouncementQuery,
  CreateAnnouncementInput,
} from "@/lib/validation/announcement";
import {
  audienceKind,
  mergeRecipients,
  needsSeason,
  withoutAuthor,
} from "./announcement-audience";
import { notify } from "./notification.service";

/**
 * Announcements: the human-authored way into everyone's inbox.
 *
 * ## Draft, then publish
 *
 * Writing is not sending. A message to a squad's families is the kind of thing
 * that wants reading twice before it goes, and a single `POST` that both
 * creates and delivers gives nobody that chance. Publishing is a separate act,
 * it happens once, and it cannot be undone — there is no unpublishing
 * something people have already read.
 *
 * ## Publishing fans out
 *
 * There is **one inbox**, not two. A reader should not have to look in a
 * notifications page *and* an announcements page to find out training moved,
 * so publishing writes a notification per recipient and the announcement
 * itself is the author's record of what was sent.
 *
 * The cost is honest and bounded: an academy-wide announcement writes one row
 * per person in the academy. At a few hundred people that is one `createMany`
 * and unremarkable. If the club ever grows past the point where that is a
 * sensible thing to do in a request, the fan-out moves to a queue — and the
 * shape of the data does not have to change for it to.
 */

/** Refuses a team the caller may not write to. */
async function requireWritableTeam(caller: AuthorizedUser, teamId: string) {
  const scope = await resolveScope(caller);
  assertWithinScope(scope.teamIds, teamId);

  const team = await findTeamById(teamId);
  if (!team) throw new ValidationError("تیم انتخاب‌شده وجود ندارد.");
  return team;
}

/**
 * Whether this caller may address this audience.
 *
 * **Checked on the way in and again on the way out**, because drafting and
 * publishing are separate acts and only the second one actually reaches
 * anybody. Checking only at creation left a coach able to publish the academy
 * manager's academy-wide draft: they could not write one, but the draft was
 * sitting in the list with a working send button beside it.
 *
 * Found by opening the page as a coach and looking at what was on it.
 */
async function assertMayAddress(
  caller: AuthorizedUser,
  target: {
    teamId?: string | null | undefined;
    schoolId?: string | null | undefined;
  },
): Promise<void> {
  if (target.teamId) {
    await requireWritableTeam(caller, target.teamId);
    return;
  }

  // Everything wider than a single squad — a school, or the whole club — is
  // the academy's to send, not a coach's.
  const scope = await resolveScope(caller);
  if (scope.teamIds === null) return;

  throw new ValidationError(
    target.schoolId
      ? "اعلان مدرسه‌ای فقط توسط مدیر ارسال می‌شود؛ تیم خود را انتخاب کنید."
      : "اعلان برای کل آکادمی فقط توسط مدیر ارسال می‌شود؛ تیم یا مدرسه مقصد را انتخاب کنید.",
  );
}

/** Presentation gating: whether this caller could publish this announcement. */
export async function canPublish(
  caller: AuthorizedUser,
  target: {
    teamId?: string | null | undefined;
    schoolId?: string | null | undefined;
  },
): Promise<boolean> {
  if (!hasPermission(caller, "notification:send")) return false;
  try {
    await assertMayAddress(caller, target);
    return true;
  } catch {
    return false;
  }
}

/**
 * The people an announcement reaches, resolved at the moment of publishing.
 *
 * Resolved then and not before: a squad that gains a player between drafting
 * and publishing should include them, and one that loses a player should not.
 * Freezing the audience at draft time would send a message to a family that
 * had already left.
 */
async function resolveRecipients(
  announcement: {
    teamId: string | null;
    schoolId: string | null;
    seasonId: string | null;
  },
  authorPersonId: string | null,
): Promise<string[]> {
  const kind = audienceKind(announcement);

  if (kind === "ACADEMY") {
    return withoutAuthor(await repo.findAllAudiencePersonIds(), authorPersonId);
  }

  const seasonId =
    announcement.seasonId ?? (await findActiveSeason())?.id ?? null;

  if (needsSeason(kind) && !seasonId) {
    throw new ValidationError(
      "فصلی فعال نیست؛ برای اعلان تیمی یا مدرسه‌ای ابتدا فصل را مشخص کنید.",
    );
  }

  if (kind === "TEAM" && announcement.teamId) {
    const [playerIds, staffPersonIds] = await Promise.all([
      findPlayerIdsInTeams([announcement.teamId], seasonId!),
      // The coaching staff are part of the squad's conversation; a message
      // about Thursday's session that reaches every family and not the
      // assistant coach is the wrong half of the room.
      repo.findStaffPersonIdsForTeam(announcement.teamId),
    ]);

    const familyPersonIds = await repo.findPersonIdsForPlayers(playerIds);
    return withoutAuthor(
      mergeRecipients(familyPersonIds, staffPersonIds),
      authorPersonId,
    );
  }

  if (kind === "SCHOOL" && announcement.schoolId) {
    const playerIds = await repo.findPlayerIdsInSchool(
      announcement.schoolId,
      seasonId!,
    );
    return withoutAuthor(
      await repo.findPersonIdsForPlayers(playerIds),
      authorPersonId,
    );
  }

  return [];
}

export async function listAnnouncements(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: AnnouncementQuery = {},
) {
  requirePermission(caller, "notification:read");

  // Drafts are the author's working copy, not news. Only someone who can send
  // sees them at all; everyone else's list starts at what was published.
  const status = hasPermission(caller, "notification:send")
    ? filters.status
    : "PUBLISHED";

  const { items, total } = await repo.listAnnouncements({
    status,
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

export async function getAnnouncement(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "notification:read");

  const announcement = await repo.findAnnouncementById(id);
  if (!announcement) throw new NotFoundError("اطلاعیه یافت نشد.");

  if (
    announcement.status === "DRAFT" &&
    !hasPermission(caller, "notification:send")
  ) {
    // Not `FORBIDDEN`: a draft should not be distinguishable from a message
    // that does not exist.
    throw new NotFoundError("اطلاعیه یافت نشد.");
  }

  return announcement;
}

export async function createAnnouncement(
  caller: AuthorizedUser,
  input: CreateAnnouncementInput,
) {
  requirePermission(caller, "notification:send");

  if (input.schoolId) {
    const school = await findSchoolById(input.schoolId);
    if (!school) throw new ValidationError("مدرسه انتخاب‌شده وجود ندارد.");
  }

  await assertMayAddress(caller, input);

  const { id } = await repo.createAnnouncement({
    title: input.title,
    body: input.body,
    type: input.type,
    teamId: input.teamId,
    schoolId: input.schoolId,
    seasonId: input.seasonId,
    authorId: caller.id,
  });

  logger.info("announcement drafted", {
    announcementId: id,
    audience: audienceKind(input),
    actorId: caller.id,
  });

  // Re-read with its relations, outside the create — see the note in the
  // repository.
  const created = await repo.findAnnouncementById(id);
  if (!created) throw new NotFoundError("اطلاعیه یافت نشد.");
  return created;
}

/**
 * Sends it.
 *
 * The status change and the fan-out are one transaction: an announcement
 * marked published whose notifications were never written is a message the
 * author believes they sent and nobody received.
 *
 * `claimForPublishing` moves `DRAFT → PUBLISHED` in the update's own filter,
 * so two people pressing the button at the same moment produce one fan-out and
 * one refusal rather than two copies in every inbox.
 */
export async function publishAnnouncement(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "notification:send");

  const announcement = await repo.findAnnouncementById(id);
  if (!announcement) throw new NotFoundError("اطلاعیه یافت نشد.");

  if (announcement.status === "PUBLISHED") {
    throw new ConflictError("این اطلاعیه قبلاً منتشر شده است.");
  }
  await assertMayAddress(caller, announcement);

  const authorPersonId = await findPersonIdForUser(caller.id);
  const recipients = await resolveRecipients(announcement, authorPersonId);

  const sent = await runInTransaction(async (tx: Db) => {
    const claimed = await repo.claimForPublishing(id, tx);
    if (!claimed) {
      throw new ConflictError("این اطلاعیه قبلاً منتشر شده است.");
    }

    const count = await notify(
      {
        personIds: recipients,
        type: announcement.type,
        title: announcement.title,
        body: announcement.body,
        link: `/dashboard/notifications`,
        announcementId: id,
        actorId: caller.id,
      },
      tx,
    );

    await repo.setRecipientCount(id, count, tx);
    return count;
  });

  // The audience size, never who is in it: an inbox list is a membership list
  // (CLAUDE.md §27).
  logger.info("announcement published", {
    announcementId: id,
    audience: audienceKind(announcement),
    recipients: sent,
    actorId: caller.id,
  });

  return repo.findAnnouncementById(id);
}

/** Presentation gating: whether to render the compose form at all. */
export function canSendAnnouncements(caller: AuthorizedUser): boolean {
  return hasPermission(caller, "notification:send");
}
