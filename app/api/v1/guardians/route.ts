import type { NextRequest } from "next/server";
import { apiHandler, created } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { createGuardian } from "@/lib/services/people.service";
import { createGuardianSchema } from "@/lib/validation/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createGuardianSchema.parse(await readJsonBody(request));
  return created(await createGuardian(caller, input));
});
