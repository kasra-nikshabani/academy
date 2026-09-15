import { NextResponse } from "next/server";
import type { AppError } from "@/lib/errors";
import type { ApiErrorBody, ApiSuccessBody, PaginationMeta } from "./types";

/** Success envelope: `{ success: true, data, meta? }` (docs/API.md). */
export function ok<TData>(
  data: TData,
  meta?: Record<string, unknown>,
  init?: { status?: number; headers?: HeadersInit },
): NextResponse<ApiSuccessBody<TData>> {
  const body: ApiSuccessBody<TData> = meta
    ? { success: true, data, meta }
    : { success: true, data };

  return NextResponse.json(body, {
    status: init?.status ?? 200,
    ...(init?.headers ? { headers: init.headers } : {}),
  });
}

/** Success envelope for list endpoints, with pagination in `meta`. */
export function okPaginated<TItem>(
  items: TItem[],
  pagination: PaginationMeta,
  extraMeta?: Record<string, unknown>,
): NextResponse<ApiSuccessBody<TItem[]>> {
  return ok(items, { ...pagination, ...extraMeta });
}

export function created<TData>(
  data: TData,
  meta?: Record<string, unknown>,
): NextResponse<ApiSuccessBody<TData>> {
  return ok(data, meta, { status: 201 });
}

/** Error envelope: `{ success: false, error: { code, message } }`. */
export function fail(error: AppError): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };

  return NextResponse.json(body, { status: error.httpStatus });
}
