import type { NextRequest } from "next/server";

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
