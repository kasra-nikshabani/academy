import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  deactivateTeam,
  getTeam,
  updateTeam,
} from "@/lib/services/academy.service";
import { updateTeamSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getTeam(caller, id));
});

export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateTeamSchema.parse(await request.json());
  return ok(await updateTeam(caller, id, input));
});

export const DELETE = apiHandler(
  async (_request: NextRequest, ctx: Context) => {
    const caller = await requireUser();
    const { id } = await ctx.params;
    return ok(await deactivateTeam(caller, id));
  },
);
