# lib/auth

Session and identity. **Implemented in Phase 2 (Authentication).**

Planned contents:

- `otp.ts` — generate / verify one-time codes (expiry, single use, attempt limit)
- `session.ts` — sign and verify the session JWT (`jose`), httpOnly cookie handling
- `current-user.ts` — resolve the caller from the request for Server Components and services
- `rate-limit.ts` — OTP send/verify throttling

Rules that apply here (CLAUDE.md §7, §27):

- an OTP code is never logged, never returned in a response, and is stored hashed
- verification is single-use: a consumed code cannot be replayed
- every failure path answers in the same time envelope, so a wrong code cannot be distinguished from an unknown mobile number
