import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  createTrainingPlan,
  listTrainingPlans,
} from "@/lib/services/training.service";
import { createTrainingPlanSchema } from "@/lib/validation/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);

  const { items, meta } = await listTrainingPlans(caller, pagination, {
    teamId: params.get("teamId") ?? undefined,
    includeInactive: params.get("includeInactive") === "true",
  });
  return okPaginated(items, meta);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createTrainingPlanSchema.parse(await readJsonBody(request));
  return created(await createTrainingPlan(caller, input));
});
