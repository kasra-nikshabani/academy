import { prisma } from "@/lib/db";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * A database handle: either the client itself, or a transaction in progress.
 *
 * Repository functions take this so a service can compose several writes into
 * one atomic step without the service ever touching Prisma directly.
 */
export type Db =
  PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Runs the given writes as one transaction.
 *
 * This exists for the journey: an event describing a membership that was never
 * created — or a membership with no event — is worse than having no timeline
 * at all, so the two are always written together.
 */
export function runInTransaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => work(tx));
}

/** Defaults to the shared client when no transaction is in progress. */
export function dbOr(tx?: Db): Db {
  return tx ?? prisma;
}
