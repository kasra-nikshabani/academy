import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listPlayerEvaluations } from "@/lib/services/evaluation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** GET /api/v1/players/:id/evaluations — the submitted ones, newest first. */
export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await listPlayerEvaluations(caller, id));
});
