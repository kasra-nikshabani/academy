import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { publishAnnouncement } from "@/lib/services/announcement.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * POST — sends it.
 *
 * Deliberately separate from the `POST` that creates the draft: a message to
 * every family in a squad should take two decisions, not one. It happens once
 * — a second call is a `CONFLICT`, not a second delivery.
 */
export const POST = apiHandler(async (_request: Request, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await publishAnnouncement(caller, id));
});
