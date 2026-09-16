import type { NextRequest } from "next/server";
import { apiHandler, created } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { addPlanExercise } from "@/lib/services/training.service";
import { trainingExerciseSchema } from "@/lib/validation/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** POST /api/v1/training/plans/:id/exercises — appends to the plan. */
export const POST = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = trainingExerciseSchema.parse(await readJsonBody(request));
  return created(await addPlanExercise(caller, id, input));
});
