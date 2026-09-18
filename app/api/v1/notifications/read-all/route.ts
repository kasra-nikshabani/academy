import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/services/notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — clears the badge. Returns how many were still unread. */
export const POST = apiHandler(async () => {
  const caller = await requireUser();
  return ok({ marked: await markAllNotificationsRead(caller) });
});
