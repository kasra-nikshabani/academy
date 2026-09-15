import { z } from "zod";
import type { PaginationMeta } from "./types";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Query-string pagination. Bounded on purpose: an unbounded `pageSize` is an
 * easy way to pull the whole players table in one request.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function parsePagination(
  searchParams: URLSearchParams,
): PaginationQuery {
  return paginationQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}

/** Translates a validated page/pageSize into Prisma's skip/take. */
export function toSkipTake(query: PaginationQuery): {
  skip: number;
  take: number;
} {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

export function buildPaginationMeta(
  query: PaginationQuery,
  total: number,
): PaginationMeta {
  return {
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}
