import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  deactivateSchool,
  getSchool,
  updateSchool,
} from "@/lib/services/academy.service";
import { updateSchoolSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export const GET = apiHandler(async (_request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await getSchool(caller, id));
});

export const PATCH = apiHandler(async (request: NextRequest, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  const input = updateSchoolSchema.parse(await request.json());
  return ok(await updateSchool(caller, id, input));
});

export const DELETE = apiHandler(
  async (_request: NextRequest, ctx: Context) => {
    const caller = await requireUser();
    const { id } = await ctx.params;
    return ok(await deactivateSchool(caller, id));
  },
);
