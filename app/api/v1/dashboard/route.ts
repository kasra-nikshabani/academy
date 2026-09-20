import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  canSeeAcademy,
  getAcademyOverview,
} from "@/lib/services/dashboard.service";
import { ForbiddenError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/dashboard — the academy-wide figures.
 *
 * Only the academy view is exposed. The squad and family sections are built
 * from services that already have their own endpoints, and a second way to ask
 * the same question is a second place for the scope rules to drift.
 */
export const GET = apiHandler(async () => {
  const caller = await requireUser();
  if (!canSeeAcademy(caller)) throw new ForbiddenError();
  return ok(await getAcademyOverview(caller));
});
