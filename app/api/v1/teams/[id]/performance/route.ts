import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getSquadPerformance } from "@/lib/services/performance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/teams/:id/performance — the squad's latest numbers.
 *
 * Team-scoped, which is what keeps it out of a parent's reach: this answers
 * "where is my squad", and the roster is not a parent's to read
 * (docs/PRODUCT_SPEC.md §8).
 */
export const GET = apiHandler(async (_request: Request, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getSquadPerformance(caller, id));
});
