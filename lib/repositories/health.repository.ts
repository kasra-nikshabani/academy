import { prisma } from "@/lib/db";

/**
 * Data access only — no business logic (CLAUDE.md §2).
 * `SELECT 1` proves the pool is alive without depending on any table, which
 * matters while the schema still has no models.
 */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
