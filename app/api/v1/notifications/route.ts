import type { NextRequest } from "next/server";
import { apiHandler, okPaginated, parsePagination } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  listMyNotifications,
  myUnreadCount,
} from "@/lib/services/notification.service";
import { notificationQuerySchema } from "@/lib/validation/announcement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/notifications — the caller's own inbox.
 *
 * There is no id in this route and no way to ask for anyone else's: the
 * narrowing is structural, so there is no scope check to forget. The unread
 * count rides along in `meta` because every caller that wants the list also
 * wants the badge.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);
  const filters = notificationQuerySchema.parse({
    unreadOnly: params.get("unread") ?? undefined,
  });

  const [{ items, meta }, unread] = await Promise.all([
    listMyNotifications(caller, pagination, filters),
    myUnreadCount(caller),
  ]);

  return okPaginated(items, meta, { unread });
});
