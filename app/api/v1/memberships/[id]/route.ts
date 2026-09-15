import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { endPlayerMembership } from "@/lib/services/enrollment.service";
import { endMembershipSchema } from "@/lib/validation/enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** DELETE ends the membership; the row stays as squad history. */
export const DELETE = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const status = new URL(request.url).searchParams.get("status") ?? "RELEASED";
  const parsed = endMembershipSchema.parse({ status });

  return ok(await endPlayerMembership(caller, id, parsed.status));
});
