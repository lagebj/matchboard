import { describe, expect, it } from "vitest";
import { rpcOk, rpcFail, buildClientCall } from "../src/rpc";
import { PROTOCOL_VERSION } from "../../../src/lib/live-match/realtime/protocol";

describe("rpcOk / rpcFail", () => {
  it("builds a well-formed success envelope", () => {
    const result = rpcOk("call-1", { foo: "bar" });
    expect(result).toEqual({ protocol: PROTOCOL_VERSION, kind: "result", id: "call-1", ok: true, result: { foo: "bar" } });
  });

  it("builds a well-formed failure envelope, optionally carrying extra error fields", () => {
    const result = rpcFail("call-2", "STALE_STATE", "out of date", { currentVersion: 7 });
    expect(result).toEqual({
      protocol: PROTOCOL_VERSION,
      kind: "result",
      id: "call-2",
      ok: false,
      error: { code: "STALE_STATE", message: "out of date", currentVersion: 7 },
    });
  });
});

describe("buildClientCall", () => {
  it("builds a call envelope with a unique id per invocation", () => {
    const a = buildClientCall("presenceChanged", { connectedCount: 1 });
    const b = buildClientCall("presenceChanged", { connectedCount: 2 });
    expect(a.protocol).toBe(PROTOCOL_VERSION);
    expect(a.kind).toBe("call");
    expect(a.method).toBe("presenceChanged");
    expect(a.id).not.toBe(b.id);
  });
});
