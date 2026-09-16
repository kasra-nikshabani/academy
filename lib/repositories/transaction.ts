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

/**
 * ## Why paginated lists use `Promise.all`, not `prisma.$transaction([…])`
 *
 * A list endpoint fetches a page and its total. Batching the two into one
 * transaction looks tidier, and buys one thing: both come from the same
 * snapshot. That guarantee is worth very little here — a total that is off by
 * one during a concurrent insert changes nothing a reader can see — and it
 * costs something real.
 *
 * The array form of `$transaction` pins every query to one connection. When
 * the `findMany` carries relations, Prisma answers it with several statements,
 * and the pg adapter issues the later ones on a client that is still busy.
 * `node-postgres` deprecates that today and `pg@9` will reject it outright.
 *
 * Measured, not assumed: the same two queries under `Promise.all` do not
 * warn, and under `$transaction([…])` they do.
 *
 * Transactions are still the right tool where a half-applied change would be
 * wrong — `setActiveSeason`, every write in `runInTransaction`. They are not
 * the right tool for reading a page and counting it.
 */
