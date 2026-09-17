import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  getPipelineQueues,
  getTalentPipeline,
} from "@/lib/services/talent.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/talent/pipeline — the funnel and the three queues.
 *
 * Defaults to the active season. `?allSeasons=true` counts every trial the
 * academy has ever run, which is the figure a yearly report wants and a
 * useless one for a manager deciding what to do today.
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;

  const filters = {
    seasonId: params.get("seasonId") ?? undefined,
    sportId: params.get("sportId") ?? undefined,
    tryoutId: params.get("tryoutId") ?? undefined,
    allSeasons: params.get("allSeasons") === "true",
  };

  const [pipeline, queues] = await Promise.all([
    getTalentPipeline(caller, filters),
    getPipelineQueues(caller, filters),
  ]);

  return ok({ ...pipeline, queues });
});
