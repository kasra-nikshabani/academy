import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  deactivateSport,
  getSport,
  updateSport,
} from "@/lib/services/academy.service";
import { updateSportSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getSport(caller, id));
});

export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateSportSchema.parse(await readJsonBody(request));
  return ok(await updateSport(caller, id, input));
});

/**
 * Deactivates rather than deletes: the structure is referenced by enrolments,
 * training and match history that must survive (CLAUDE.md §2).
 */
export const DELETE = apiHandler(
  async (_request: NextRequest, ctx: Context) => {
    const caller = await requireUser();
    const { id } = await ctx.params;
    return ok(await deactivateSport(caller, id));
  },
);
