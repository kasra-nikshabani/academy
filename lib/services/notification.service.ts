import { buildPaginationMeta, type PaginationQuery } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requirePermission, type AuthorizedUser } from "@/lib/permissions";
import { findPersonIdForUser } from "@/lib/repositories/people.repository";
import * as repo from "@/lib/repositories/notification.repository";
import type { Db } from "@/lib/repositories/transaction";
import type { NotificationType } from "@/lib/generated/prisma/enums";

/**
 * The inbox.
 *
 * A notification belongs to a **person**, and the caller's own person is the
 * only one they can reach — there is no id in any of these signatures for
 * someone else's inbox, so there is no scope check to forget. The narrowing is
 * structural rather than enforced.
 *
 * Someone signed in without a person record (a bare administrator account, for
 * instance) has no inbox rather than an error: an empty list is the truthful
 * answer, and it keeps the badge on every page from throwing.
 */

/** The caller's own person, or null when their account has none. */
async function ownPersonId(caller: AuthorizedUser): Promise<string | null> {
  return findPersonIdForUser(caller.id);
}

export async function listMyNotifications(
  caller: AuthorizedUser,
  pagination: PaginationQuery,
  filters: { unreadOnly?: boolean | undefined } = {},
) {
  requirePermission(caller, "notification:read");

  const personId = await ownPersonId(caller);
  if (!personId) {
    return { items: [], meta: buildPaginationMeta(pagination, 0) };
  }

  const { items, total } = await repo.listForPerson({
    personId,
    unreadOnly: filters.unreadOnly,
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  });

  return { items, meta: buildPaginationMeta(pagination, total) };
}

/**
 * The badge.
 *
 * Called on every signed-in page, so it is a `count` against an index and
 * never loads a row. No permission check: a reader who somehow lacks
 * `notification:read` simply has nothing unread, and failing the whole layout
 * over a badge would be the wrong trade.
 */
export async function myUnreadCount(caller: AuthorizedUser): Promise<number> {
  const personId = await ownPersonId(caller);
  if (!personId) return 0;
  return repo.countUnread(personId);
}

export async function markNotificationRead(
  caller: AuthorizedUser,
  id: string,
): Promise<{ id: string; readAt: Date | null }> {
  requirePermission(caller, "notification:read");

  const personId = await ownPersonId(caller);
  if (!personId) throw new NotFoundError("اعلان یافت نشد.");

  // The timestamp is made here and handed down, so what comes back is the
  // value that was actually stored. Returning a second `new Date()` from the
  // success path looks harmless and is not: the two differ by a millisecond,
  // and the caller is then told a `readAt` the database does not hold.
  const readAt = new Date();

  // Ownership lives in the update's own filter, so someone else's id and an
  // id that does not exist are answered identically — a caller cannot map the
  // table by probing.
  const changed = await repo.markRead(id, personId, readAt);
  if (!changed) {
    const existing = await repo.findNotificationById(id);
    if (!existing || existing.personId !== personId) {
      throw new NotFoundError("اعلان یافت نشد.");
    }
    // It was already read. Saying so is not an error, and re-stamping it would
    // lose when they first saw it.
    return { id, readAt: existing.readAt };
  }

  return { id, readAt };
}

export async function markAllNotificationsRead(
  caller: AuthorizedUser,
): Promise<number> {
  requirePermission(caller, "notification:read");

  const personId = await ownPersonId(caller);
  if (!personId) return 0;

  const count = await repo.markAllRead(personId, new Date());
  logger.info("notifications marked read", { count, actorId: caller.id });
  return count;
}

// --- raising notifications --------------------------------------------------

export interface NotifyInput {
  personIds: readonly string[];
  type: NotificationType;
  title: string;
  body?: string | undefined;
  link?: string | undefined;
  announcementId?: string | undefined;
  actorId?: string | undefined;
}

/**
 * Raises a notification for a set of people.
 *
 * Takes a `tx` so a caller can make it part of a larger act. The tryout
 * acceptance does exactly that: telling the family is inside the same
 * transaction as accepting them, so there is no state where a family has been
 * accepted and not told, nor one where they were told about an acceptance that
 * rolled back (docs/BUSINESS_RULES.md §3).
 *
 * No permission check here — this is the internal seam other services call,
 * and the permission question belongs to whatever action raised it. The
 * human-authored route in is `publishAnnouncement`, which does check.
 */
export async function notify(input: NotifyInput, tx?: Db): Promise<number> {
  if (input.personIds.length === 0) return 0;

  return repo.createNotifications(
    [...new Set(input.personIds)].map((personId) => ({
      personId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      announcementId: input.announcementId,
      actorId: input.actorId,
    })),
    tx,
  );
}

/**
 * Tells a player's family something.
 *
 * The player **and** their guardians, because a twelve-year-old may have no
 * account and the message is for the household. One notification each, so a
 * parent reading it does not mark it read for the child.
 */
export async function notifyPlayer(
  playerId: string,
  message: Omit<NotifyInput, "personIds">,
  tx?: Db,
): Promise<number> {
  const personIds = await repo.findPersonIdsForPlayers([playerId]);
  return notify({ ...message, personIds }, tx);
}
