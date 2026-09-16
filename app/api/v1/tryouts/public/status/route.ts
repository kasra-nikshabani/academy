import type { NextRequest } from "next/server";
import { apiHandler, ok } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { lookupApplication } from "@/lib/services/tryout.service";
import { applicationStatusLookupSchema } from "@/lib/validation/tryout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — follows an application. **Public.**
 *
 * A POST rather than a GET so the tracking code and the mobile number stay
 * out of the URL, and therefore out of browser history, server logs and
 * referrer headers (docs/SECURITY.md).
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const input = applicationStatusLookupSchema.parse(
    await readJsonBody(request),
  );
  return ok(await lookupApplication(input.trackingCode, input.mobile));
});
