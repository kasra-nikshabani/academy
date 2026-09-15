import type { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  type AppError,
  InternalError,
  RateLimitError,
  ValidationError,
  isAppError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import { fail } from "./response";
import type { ApiErrorBody } from "./types";

/** Zod issues → a compact, client-friendly field/message list. */
function toFieldDetails(error: ZodError): Array<{
  field: string;
  message: string;
}> {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof ZodError) {
    return new ValidationError(undefined, toFieldDetails(error));
  }

  return new InternalError();
}

function errorResponse(error: AppError): NextResponse<ApiErrorBody> {
  const response = fail(error);
  if (error instanceof RateLimitError) {
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
  }
  return response;
}

/**
 * Wraps a Route Handler so every failure leaves as the documented error
 * envelope and every unexpected failure is logged once, with a correlation id.
 *
 * Route Handlers stay thin (CLAUDE.md §4): parse → authorize → call a service.
 * They must not contain business logic, and they never touch repositories.
 */
export function apiHandler<TContext = unknown>(
  handler: (request: NextRequest, context: TContext) => Promise<Response>,
) {
  return async (request: NextRequest, context: TContext): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (caught) {
      const appError = toAppError(caught);

      // Expected failures are part of normal operation; only surprises are
      // worth an error-level log with a stack.
      if (appError.httpStatus >= 500) {
        const requestId = crypto.randomUUID();
        logger.error("unhandled error in route handler", {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          error: caught instanceof Error ? caught : String(caught),
        });
        const response = errorResponse(appError);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      logger.debug("request rejected", {
        code: appError.code,
        method: request.method,
        path: new URL(request.url).pathname,
      });

      return errorResponse(appError);
    }
  };
}
