import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/services/notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH — marks one notification read.
 *
 * Someone else's id and an id that does not exist both answer `NOT_FOUND`, so
 * the table cannot be mapped by probing. Marking an already-read notification
 * is not an error and does not move `readAt`.
 */
export const PATCH = apiHandler(async (_request: Request, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await markNotificationRead(caller, id));
});
