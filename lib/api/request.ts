import type { NextRequest } from "next/server";
import { ValidationError } from "@/lib/errors";

/**
 * Best-effort client address for rate limiting.
 *
 * Behind Nginx the real address arrives in `x-forwarded-for`; the first entry
 * is the client. This is only ever used to produce a hash for abuse counting —
 * never stored or logged raw.
 */
export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

/**
 * Reads a JSON request body.
 *
 * `request.json()` throws a raw `SyntaxError` on an empty or malformed body,
 * which the error mapper cannot tell from a genuine bug and reports as a 500.
 * A client sending bad JSON is a client error, so it is reported as one.
 */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("بدنه درخواست معتبر نیست.");
  }
}
