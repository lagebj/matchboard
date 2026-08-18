import { describe, it, expect } from "vitest";
import { AppError } from "../../lib/security/errors";

describe("AuthenticationError (direct AppError)", () => {
  it("creates 401 error with correct code and message", () => {
    const error = new AppError("UNAUTHORIZED", 401, "Coach access required");
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Coach access required");
    expect(error.name).toBe("AppError");
  });

  it("creates 401 error with default message", () => {
    const error = new AppError("UNAUTHORIZED", 401, "Authentication required");
    expect(error.message).toBe("Authentication required");
  });
});

describe("AuthorizationError (direct AppError)", () => {
  it("creates 403 error with correct code and message", () => {
    const error = new AppError("FORBIDDEN", 403, "Access denied");
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("Access denied");
  });

  it("creates 403 error with default message", () => {
    const error = new AppError("FORBIDDEN", 403, "Access denied");
    expect(error.message).toBe("Access denied");
  });
});