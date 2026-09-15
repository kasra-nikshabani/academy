import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPaginationMeta,
  parsePagination,
  toSkipTake,
} from "@/lib/api/pagination";

describe("pagination", () => {
  it("falls back to defaults when the query is empty", () => {
    const query = parsePagination(new URLSearchParams());

    expect(query).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("reads page and pageSize from the query string", () => {
    const query = parsePagination(new URLSearchParams("page=3&pageSize=50"));

    expect(query).toEqual({ page: 3, pageSize: 50 });
  });

  it("rejects a pageSize above the cap", () => {
    expect(() =>
      parsePagination(new URLSearchParams(`pageSize=${MAX_PAGE_SIZE + 1}`)),
    ).toThrow();
  });

  it("rejects a page below 1", () => {
    expect(() => parsePagination(new URLSearchParams("page=0"))).toThrow();
  });

  it("translates page/pageSize into skip and take", () => {
    expect(toSkipTake({ page: 1, pageSize: 20 })).toEqual({
      skip: 0,
      take: 20,
    });
    expect(toSkipTake({ page: 3, pageSize: 20 })).toEqual({
      skip: 40,
      take: 20,
    });
  });

  it("builds the documented meta shape", () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 100)).toEqual({
      page: 1,
      pageSize: 20,
      total: 100,
      totalPages: 5,
    });
  });

  it("rounds a partial last page up", () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 101).totalPages).toBe(
      6,
    );
  });

  it("reports zero pages for an empty result", () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 0).totalPages).toBe(
      0,
    );
  });
});
