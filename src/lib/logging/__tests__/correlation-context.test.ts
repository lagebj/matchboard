import { describe, it, expect } from "vitest";
import { getCorrelationId, setCorrelationId } from "../correlation-context";

describe("correlation-context", () => {
  it("returns undefined when no correlationId has been set", async () => {
    const result = await new Promise<string | undefined>((resolve) => {
      // A fresh macrotask with no prior setCorrelationId() call in this chain.
      setImmediate(() => resolve(getCorrelationId()));
    });
    expect(result).toBeUndefined();
  });

  it("propagates a set correlationId to code that runs after it, within the same async chain", async () => {
    async function innerWork(): Promise<string | undefined> {
      await Promise.resolve();
      return getCorrelationId();
    }

    async function requestLikeFlow(): Promise<string | undefined> {
      setCorrelationId("test-correlation-id");
      return innerWork();
    }

    const result = await requestLikeFlow();
    expect(result).toBe("test-correlation-id");
  });

  // AsyncLocalStorage.enterWith() (used by setCorrelationId(), mirroring the existing
  // setTenantOrganisationId()/setTenantUserId() pattern in tenant-async-storage.ts) mutates the
  // *ambient* store rather than scoping to a callback the way AsyncLocalStorage.run() does. Each
  // async operation (a setTimeout call, a Promise continuation) captures a snapshot of whatever
  // the ambient store is AT THE MOMENT it's scheduled — not a live reference — so as long as each
  // flow calls setCorrelationId() itself before doing any async work of its own (exactly what
  // requireActorContext() does, as literally its first action), each flow's own value is what
  // gets captured into its own continuation, even when multiple flows are invoked synchronously
  // side by side (e.g. via Promise.all). The risk this pattern does NOT protect against is a flow
  // that relies on an *inherited* ambient value instead of setting its own.
  it("each flow retains its own correlationId when each sets it before its own first await, even as Promise.all siblings", async () => {
    async function flowA(): Promise<string | undefined> {
      setCorrelationId("flow-a-id");
      await new Promise((resolve) => setTimeout(resolve, 5));
      return getCorrelationId();
    }

    async function flowB(): Promise<string | undefined> {
      setCorrelationId("flow-b-id");
      await new Promise((resolve) => setTimeout(resolve, 1));
      return getCorrelationId();
    }

    const [resultA, resultB] = await Promise.all([flowA(), flowB()]);
    expect(resultA).toBe("flow-a-id");
    expect(resultB).toBe("flow-b-id");
  });

  it("does not leak a correlationId into a genuinely independent macrotask (real request/request isolation)", async () => {
    async function requestLikeHandler(id: string): Promise<string | undefined> {
      // setImmediate schedules a fresh macrotask, matching how a new incoming
      // request/action invocation begins its own independent async root in practice.
      return new Promise((resolve) => {
        setImmediate(() => {
          setCorrelationId(id);
          resolve(getCorrelationId());
        });
      });
    }

    const [resultA, resultB] = await Promise.all([
      requestLikeHandler("request-a"),
      requestLikeHandler("request-b"),
    ]);
    expect(resultA).toBe("request-a");
    expect(resultB).toBe("request-b");
  });
});
