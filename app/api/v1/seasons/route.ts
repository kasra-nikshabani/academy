import type { NextRequest } from "next/server";
import { apiHandler, created, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createSeason, listSeasons } from "@/lib/services/academy.service";
import { createSeasonSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const caller = await requireUser();
  return ok(await listSeasons(caller));
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createSeasonSchema.parse(await request.json());
  return created(await createSeason(caller, input));
});
