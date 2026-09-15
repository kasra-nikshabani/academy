import { apiHandler, ok } from "@/lib/api";
import { getHealthReport } from "@/lib/services/health.service";

/** Prisma requires the Node.js runtime. */
export const runtime = "nodejs";
/** Health must never be served from the cache. */
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/health
 * Thin handler: no business logic, no database access — it delegates to the
 * service and wraps the result in the standard envelope.
 */
export const GET = apiHandler(async () => {
  const report = await getHealthReport();
  return ok(report, { service: "academy-os" });
});
