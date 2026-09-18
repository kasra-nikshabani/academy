import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getAnnouncement } from "@/lib/services/announcement.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: Request, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getAnnouncement(caller, id));
});
