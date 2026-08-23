import { describe, it, expect } from "vitest";
import { logger, correlationMixin } from "../logger";
import { setCorrelationId, correlationAsyncStorage } from "../logging/correlation-context";

describe("logger", () => {
  it("exposes the standard pino level methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("correlationMixin returns an empty object when no correlationId is set", async () => {
    await new Promise<void>((resolve) => {
      // Run inside a fresh async root so no correlationId leaks in from another test.
      setImmediate(() => {
        expect(correlationMixin()).toEqual({});
        resolve();
      });
    });
  });

  it("correlationMixin includes the ambient correlationId once set", async () => {
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        setCorrelationId("mixin-test-id");
        expect(correlationMixin()).toEqual({ correlationId: "mixin-test-id" });
        resolve();
      });
    });
  });

  it("correlationAsyncStorage is the same storage setCorrelationId writes to", async () => {
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        setCorrelationId("storage-check-id");
        expect(correlationAsyncStorage.getStore()).toEqual({ correlationId: "storage-check-id" });
        resolve();
      });
    });
  });
});
