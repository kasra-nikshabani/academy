import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listPlayerDocuments } from "@/lib/services/document.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/players/:id/documents — the paperwork on a player.
 *
 * Metadata only; the bytes come from `/documents/:id`. A medical document is
 * left out of the list entirely for a caller who may not open it, so its
 * existence is not something a coach can learn from the count.
 */
export const GET = apiHandler(async (_request: Request, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await listPlayerDocuments(caller, id));
});
