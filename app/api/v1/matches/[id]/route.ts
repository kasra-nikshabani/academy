import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  cancelMatch,
  getMatch,
  updateMatch,
} from "@/lib/services/match.service";
import { cancelMatchSchema, updateMatchSchema } from "@/lib/validation/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getMatch(caller, id));
});

export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateMatchSchema.parse(await readJsonBody(request));
  return ok(await updateMatch(caller, id, input));
});

/** DELETE calls the fixture off; the row and its reason stay. */
export const DELETE = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const { status, reason } = cancelMatchSchema.parse({
    status: params.get("status") ?? undefined,
    reason: params.get("reason") ?? undefined,
  });

  return ok(await cancelMatch(caller, id, status, reason));
});
