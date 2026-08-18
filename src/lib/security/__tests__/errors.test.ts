import { describe, it, expect } from "vitest";
import {
  AppError,
  safeErrorResponse,
  notFound,
  validationError,
  unauthorizedError,
  forbiddenError,
  conflictError,
  rateLimitedError,
  internalError,
} from "../errors";

describe("safeErrorResponse", () => {
  it("returns AppError details for AppError instances", () => {
    const error = notFound("Match round not found");
    const response = safeErrorResponse(error);
    expect(response.error).toBe("Match round not found");
    expect(response.code).toBe("NOT_FOUND");
    expect(response.statusCode).toBe(404);
  });

  it("returns generic internal error for unknown errors", () => {
    const error = new Error("Some database constraint violation: UNIQUE violation on Selection");
    const response = safeErrorResponse(error);
    expect(response.error).toBe("Internal error");
    expect(response.code).toBe("INTERNAL");
    expect(response.statusCode).toBe(500);
  });

  it("returns generic internal error for non-Error values", () => {
    const response = safeErrorResponse("string error");
    expect(response.error).toBe("Internal error");
    expect(response.code).toBe("INTERNAL");
    expect(response.statusCode).toBe(500);
  });

  it("returns generic internal error for null", () => {
    const response = safeErrorResponse(null);
    expect(response.error).toBe("Internal error");
    expect(response.statusCode).toBe(500);
  });

  it("does not leak database error messages", () => {
    const dbError = new Error("PrismaClientKnownRequestError: Unique constraint failed on the fields: (playerId, matchRoundId)");
    const response = safeErrorResponse(dbError);
    expect(response.error).toBe("Internal error");
    expect(response.error).not.toContain("PrismaClientKnownRequestError");
    expect(response.error).not.toContain("playerId");
  });

  it("handles custom 401 auth errors", () => {
    const error = new AppError("UNAUTHORIZED", 401, "Coach access required");
    const response = safeErrorResponse(error);
    expect(response.error).toBe("Coach access required");
    expect(response.code).toBe("UNAUTHORIZED");
    expect(response.statusCode).toBe(401);
  });

  it("handles custom 403 auth errors", () => {
    const error = new AppError("FORBIDDEN", 403, "Access denied");
    const response = safeErrorResponse(error);
    expect(response.error).toBe("Access denied");
    expect(response.code).toBe("FORBIDDEN");
    expect(response.statusCode).toBe(403);
  });
});

describe("AppError factory functions", () => {
  it("creates NOT_FOUND error with 404", () => {
    const error = notFound();
    expect(error.code).toBe("NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Resource not found");
  });

  it("creates VALIDATION error with 400", () => {
    const error = validationError("matchRoundId is required");
    expect(error.code).toBe("VALIDATION");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("matchRoundId is required");
  });

  it("creates UNAUTHORIZED error with 401", () => {
    const error = unauthorizedError();
    expect(error.statusCode).toBe(401);
  });

  it("creates FORBIDDEN error with 403", () => {
    const error = forbiddenError();
    expect(error.statusCode).toBe(403);
  });

  it("creates CONFLICT error with 409", () => {
    const error = conflictError();
    expect(error.statusCode).toBe(409);
  });

  it("creates RATE_LIMITED error with 429", () => {
    const error = rateLimitedError();
    expect(error.statusCode).toBe(429);
  });

  it("creates INTERNAL error with 500", () => {
    const error = internalError();
    expect(error.statusCode).toBe(500);
  });
});