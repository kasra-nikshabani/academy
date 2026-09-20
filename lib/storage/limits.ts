/**
 * Upload limits.
 *
 * Deliberately **not** in `document.service.ts`. That module reaches
 * repositories and therefore Prisma; importing a single constant from it into
 * the upload form would pull the database client into the browser bundle — the
 * same trap the chart palette hit in Phase 14, and the same fix: a constant is
 * not interactive, so it lives where both sides can reach it.
 */

/** Eight megabytes: a phone photograph of a birth certificate, with room. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
