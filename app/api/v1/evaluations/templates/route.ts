import type { NextRequest } from "next/server";
import { apiHandler, created, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  createEvaluationTemplate,
  listEvaluationTemplates,
} from "@/lib/services/evaluation.service";
import { createTemplateSchema } from "@/lib/validation/evaluation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;

  return ok(
    await listEvaluationTemplates(caller, {
      sportId: params.get("sportId") ?? undefined,
      includeInactive: params.get("includeInactive") === "true",
    }),
  );
});

export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createTemplateSchema.parse(await readJsonBody(request));
  return created(await createEvaluationTemplate(caller, input));
});
