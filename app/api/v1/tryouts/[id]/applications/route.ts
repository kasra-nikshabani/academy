import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  getTryoutFunnel,
  listTryoutApplications,
} from "@/lib/services/tryout.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** The applications for one trial, with the funnel counts in `meta`. */
export const GET = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const status = new URL(request.url).searchParams.get("status") ?? undefined;

  const [items, funnel] = await Promise.all([
    listTryoutApplications(caller, id, status),
    getTryoutFunnel(caller, id),
  ]);

  return ok(items, funnel);
});
