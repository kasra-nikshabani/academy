import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  getEvaluation,
  saveEvaluation,
} from "@/lib/services/evaluation.service";
import { saveEvaluationSchema } from "@/lib/validation/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getEvaluation(caller, id));
});

/**
 * PUT — saves marks, and finishes the evaluation when `submit` is true.
 *
 * One request because it is one action for a coach: the last mark and "done"
 * happen together. Submitting freezes the sheet.
 */
export const PUT = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = saveEvaluationSchema.parse(await readJsonBody(request));
  return ok(await saveEvaluation(caller, id, input));
});
