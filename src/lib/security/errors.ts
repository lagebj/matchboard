import { logger } from "@/lib/logger";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "Resource not found",
  VALIDATION: "Invalid request",
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Access denied",
  CONFLICT: "Conflict occurred",
  RATE_LIMITED: "Too many requests. Please wait.",
  INTERNAL: "Internal error",
};

export class AppError extends Error {
  constructor(
    public readonly code: keyof typeof ERROR_MESSAGES,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError("NOT_FOUND", 404, message);
}

export function validationError(message = "Invalid request"): AppError {
  return new AppError("VALIDATION", 400, message);
}

export function unauthorizedError(message = "Unauthorized"): AppError {
  return new AppError("UNAUTHORIZED", 401, message);
}

export function forbiddenError(message = "Access denied"): AppError {
  return new AppError("FORBIDDEN", 403, message);
}

export function conflictError(message = "Conflict occurred"): AppError {
  return new AppError("CONFLICT", 409, message);
}

export function rateLimitedError(message = "Too many requests. Please wait."): AppError {
  return new AppError("RATE_LIMITED", 429, message);
}

export function internalError(message = "Internal error"): AppError {
  return new AppError("INTERNAL", 500, message);
}

export function safeErrorResponse(error: unknown): { error: string; code: string; statusCode: number } {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  logger.error({ err: error }, "[AppError] Unhandled error");

  return {
    error: ERROR_MESSAGES.INTERNAL,
    code: "INTERNAL",
    statusCode: 500,
  };
}