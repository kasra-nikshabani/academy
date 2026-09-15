import type { NextRequest } from "next/server";
import { apiHandler, created, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAgeGroup, listAgeGroups } from "@/lib/services/academy.service";
import { createAgeGroupSchema } from "@/lib/validation/academy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;

  return ok(
    await listAgeGroups(
      caller,
      params.get("sportId") ?? undefined,
      params.get("includeInactive") === "true",
    ),
  );
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createAgeGroupSchema.parse(await request.json());
  return created(await createAgeGroup(caller, input));
});
