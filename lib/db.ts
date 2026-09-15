import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { env, isProduction } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * Prisma 7 connects through a driver adapter rather than a schema-level `url`,
 * so the connection string is supplied here. In development the instance is
 * cached on `globalThis` to survive hot reloads — without it, every reload
 * opens a new pool and the database runs out of connections.
 *
 * Only `lib/repositories/**` may import this module; ESLint blocks UI and
 * Route Handlers from reaching it (CLAUDE.md §4).
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: isProduction ? ["error"] : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
