import type { NextRequest } from "next/server";
import { apiHandler, created, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createSport, listSports } from "@/lib/services/academy.service";
import { createSportSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const includeInactive =
    new URL(request.url).searchParams.get("includeInactive") === "true";

  return ok(await listSports(caller, includeInactive));
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createSportSchema.parse(await request.json());

  return created(await createSport(caller, input));
});
