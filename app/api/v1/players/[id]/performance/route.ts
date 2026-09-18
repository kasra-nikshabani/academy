import type { NextRequest } from "next/server";
import { apiHandler, created, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  getPlayerPerformance,
  savePlayerMeasurements,
} from "@/lib/services/performance.service";
import {
  performanceQuerySchema,
  savePerformanceSchema,
} from "@/lib/validation/performance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/players/:id/performance — one player's measurements and trends.
 *
 * Narrowed by player scope, so this is the endpoint a parent reads and it
 * never returns another child's numbers.
 */
export const GET = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;

  const params = new URL(request.url).searchParams;
  const filters = performanceQuerySchema.parse({
    ...(params.get("metric") ? { metric: params.get("metric") } : {}),
    ...(params.get("from") ? { from: params.get("from") } : {}),
    ...(params.get("to") ? { to: params.get("to") } : {}),
  });

  return ok(await getPlayerPerformance(caller, id, filters));
});

/** POST — everything measured on one day, written as one act. */
export const POST = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = savePerformanceSchema.parse(await readJsonBody(request));
  return created(await savePlayerMeasurements(caller, id, input));
});
