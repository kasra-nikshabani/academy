import type { NextRequest } from "next/server";
import { apiHandler, created, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  listEvaluations,
  requestEvaluation,
} from "@/lib/services/evaluation.service";
import {
  evaluationQuerySchema,
  requestEvaluationSchema,
} from "@/lib/validation/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — the evaluations the caller may see: their assignments and squads. */
export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const filters = evaluationQuerySchema.parse({
    status: params.get("status") ?? undefined,
    playerId: params.get("playerId") ?? undefined,
    applicationId: params.get("applicationId") ?? undefined,
  });

  return ok(await listEvaluations(caller, filters));
});

/** POST — asks a named coach to evaluate a player. */
export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = requestEvaluationSchema.parse(await readJsonBody(request));
  return created(await requestEvaluation(caller, input));
});
