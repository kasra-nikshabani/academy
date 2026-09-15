import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";

/**
 * Sends anonymous visitors to the sign-in page before a protected route
 * renders.
 *
 * This is a redirect for the user's benefit, **not** the access control.
 * Middleware runs on the edge and only checks the token's signature and
 * expiry — it cannot see that an administrator blocked the account a minute
 * ago. Every protected page and service re-reads the user from the database
 * and decides for itself (docs/PERMISSIONS.md §4).
 */
const PROTECTED_PREFIXES = ["/dashboard"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(
    process.env["SESSION_COOKIE_NAME"] ?? "academy_session",
  )?.value;

  if (token && (await verifySessionToken(token))) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
