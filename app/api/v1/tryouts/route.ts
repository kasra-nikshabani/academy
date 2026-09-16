import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import { createTryout, listTryouts } from "@/lib/services/tryout.service";
import { createTryoutSchema, tryoutQuerySchema } from "@/lib/validation/tryout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);
  const filters = tryoutQuerySchema.parse({
    status: params.get("status") ?? undefined,
    sportId: params.get("sportId") ?? undefined,
  });

  const { items, meta } = await listTryouts(caller, pagination, filters);
  return okPaginated(items, meta);
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createTryoutSchema.parse(await readJsonBody(request));
  return created(await createTryout(caller, input));
});
