import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  cancelTrainingSession,
  getTrainingSession,
  updateTrainingSession,
} from "@/lib/services/training.service";
import {
  cancelTrainingSessionSchema,
  updateTrainingSessionSchema,
} from "@/lib/validation/training";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getTrainingSession(caller, id));
});

export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateTrainingSessionSchema.parse(await readJsonBody(request));
  return ok(await updateTrainingSession(caller, id, input));
});

/** DELETE cancels the session; the row and its reason stay (CLAUDE.md §2). */
export const DELETE = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const { reason } = cancelTrainingSessionSchema.parse({
    reason: new URL(request.url).searchParams.get("reason") ?? undefined,
  });

  return ok(await cancelTrainingSession(caller, id, reason));
});
