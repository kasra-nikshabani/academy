import { ERROR_CODES, type ErrorCode } from "./error-codes";

/**
 * Base class for every expected (non-bug) failure.
 * Services throw these; the API layer turns them into the error envelope.
 * Anything that is NOT an AppError is treated as an unexpected bug and is
 * reported to the client as INTERNAL_ERROR with no internal detail.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number,
    details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = "داده‌های ارسالی نامعتبر است.", details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "برای این عملیات باید وارد شوید.") {
    super(ERROR_CODES.UNAUTHENTICATED, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "شما اجازه دسترسی به این بخش را ندارید.") {
    super(ERROR_CODES.FORBIDDEN, message, 403);
  }
}

/**
 * Raised when the caller holds the right permission but the requested record
 * lies outside their scope (e.g. a coach reaching for another team, a parent
 * reaching for another family's player). Kept distinct from FORBIDDEN so scope
 * violations are auditable on their own.
 */
export class OutOfScopeError extends AppError {
  constructor(message = "این رکورد خارج از محدوده دسترسی شماست.") {
    super(ERROR_CODES.OUT_OF_SCOPE, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "رکورد مورد نظر یافت نشد.") {
    super(ERROR_CODES.NOT_FOUND, message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "این رکورد از قبل وجود دارد.", details?: unknown) {
    super(ERROR_CODES.CONFLICT, message, 409, details);
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(
    retryAfterSeconds: number,
    message = "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
  ) {
    super(ERROR_CODES.RATE_LIMITED, message, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class InternalError extends AppError {
  constructor(message = "خطای غیرمنتظره‌ای رخ داد.") {
    super(ERROR_CODES.INTERNAL_ERROR, message, 500);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
