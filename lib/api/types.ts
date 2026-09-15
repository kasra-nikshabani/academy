import type { ErrorCode } from "@/lib/errors";

/** Pagination metadata, shaped exactly as documented in docs/API.md. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessBody<TData> {
  success: true;
  data: TData;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    /** Field-level validation problems; omitted for non-validation errors. */
    details?: unknown;
  };
}

export type ApiBody<TData> = ApiSuccessBody<TData> | ApiErrorBody;
