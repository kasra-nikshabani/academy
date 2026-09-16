import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  removePlanExercise,
  updatePlanExercise,
} from "@/lib/services/training.service";
import { updateTrainingExerciseSchema } from "@/lib/validation/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateTrainingExerciseSchema.parse(await readJsonBody(request));
  return ok(await updatePlanExercise(caller, id, input));
});

/**
 * Removes a line from a plan.
 *
 * The only real delete in the training module: an exercise is planning
 * material, not a record of something that happened.
 */
export const DELETE = apiHandler(
  async (_request: NextRequest, ctx: Context) => {
    const caller = await requireUser();
    const { id } = await ctx.params;
    return ok(await removePlanExercise(caller, id));
  },
);
