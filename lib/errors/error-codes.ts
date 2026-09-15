/**
 * Stable, machine-readable error codes returned in the API error envelope.
 * Clients branch on these; the `message` field is for humans and may change.
 */
export const ERROR_CODES = {
  // --- validation ---
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // --- authentication / authorization ---
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",

  // --- resources ---
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",

  // --- abuse control ---
  RATE_LIMITED: "RATE_LIMITED",

  // --- catch-all ---
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
