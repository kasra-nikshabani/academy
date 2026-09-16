import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  createTrainingSession,
  listTrainingSessions,
} from "@/lib/services/training.service";
import {
  createTrainingSessionSchema,
  trainingSessionQuerySchema,
} from "@/lib/validation/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/training/sessions — the calendar, narrowed to the caller. */
export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);
  const filters = trainingSessionQuerySchema.parse({
    teamId: params.get("teamId") ?? undefined,
    status: params.get("status") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  const { items, meta } = await listTrainingSessions(
    caller,
    pagination,
    filters,
  );
  return okPaginated(items, meta);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createTrainingSessionSchema.parse(await readJsonBody(request));
  return created(await createTrainingSession(caller, input));
});
