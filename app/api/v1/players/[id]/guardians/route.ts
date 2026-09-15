import type { NextRequest } from "next/server";
import { apiHandler, created } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { linkGuardian } from "@/lib/services/people.service";
import { linkGuardianSchema } from "@/lib/validation/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** POST /api/v1/players/:id/guardians — joins a guardian to a player. */
export const POST = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = linkGuardianSchema.parse(await request.json());
  return created(await linkGuardian(caller, id, input));
});
