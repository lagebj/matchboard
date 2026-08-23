import { describe, it, expect } from "vitest";
import { parseIncomingMessage, parseRawSocketMessage, exceedsMaxMessageSize } from "../protocol-schemas";
import { PROTOCOL_VERSION, MAX_MESSAGE_BYTES } from "../protocol";

describe("parseIncomingMessage — valid call", () => {
  it("accepts a valid call to a known session method", () => {
    const result = parseIncomingMessage(
      { protocol: PROTOCOL_VERSION, kind: "call", id: "abc", method: "recordEvent", params: { foo: 1 } },
      "toSession",
    );
    expect(result.ok).toBe(true);
  });

  it("accepts a valid call to a known client method", () => {
    const result = parseIncomingMessage(
      { protocol: PROTOCOL_VERSION, kind: "call", id: "abc", method: "applyEvent", params: {} },
      "toClient",
    );
    expect(result.ok).toBe(true);
  });
});

describe("parseIncomingMessage — valid result", () => {
  it("accepts a valid success result", () => {
    const result = parseIncomingMessage(
      { protocol: PROTOCOL_VERSION, kind: "result", id: "abc", ok: true, result: { version: 1 } },
      "toSession",
    );
    expect(result.ok).toBe(true);
  });

  it("accepts a valid failure result", () => {
    const result = parseIncomingMessage(
      {
        protocol: PROTOCOL_VERSION,
        kind: "result",
        id: "abc",
        ok: false,
        error: { code: "STALE_STATE", message: "stale", currentVersion: 5 },
      },
      "toSession",
    );
    expect(result.ok).toBe(true);
  });
});

describe("parseIncomingMessage — malformed payload", () => {
  it("rejects a message missing required fields", () => {
    const result = parseIncomingMessage({ protocol: PROTOCOL_VERSION, kind: "call" }, "toSession");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_MESSAGE");
  });

  it("rejects a non-object payload", () => {
    const result = parseIncomingMessage("not an object", "toSession");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_MESSAGE");
  });

  it("rejects a failure result with an unknown error code", () => {
    const result = parseIncomingMessage(
      { protocol: PROTOCOL_VERSION, kind: "result", id: "abc", ok: false, error: { code: "NOT_A_REAL_CODE", message: "x" } },
      "toSession",
    );
    expect(result.ok).toBe(false);
  });
});

describe("parseIncomingMessage — unsupported protocol", () => {
  it("rejects a message with a future protocol version", () => {
    const result = parseIncomingMessage(
      { protocol: 2, kind: "call", id: "abc", method: "recordEvent", params: {} },
      "toSession",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PROTOCOL_UNSUPPORTED");
  });
});

describe("parseIncomingMessage — unknown method", () => {
  it("rejects a call to a method not in the session allowlist", () => {
    const result = parseIncomingMessage(
      { protocol: PROTOCOL_VERSION, kind: "call", id: "abc", method: "deleteEverything", params: {} },
      "toSession",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("METHOD_NOT_FOUND");
  });

  it("rejects a session-only method called in the client direction", () => {
    const result = parseIncomingMessage(
      { protocol: PROTOCOL_VERSION, kind: "call", id: "abc", method: "recordEvent", params: {} },
      "toClient",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("METHOD_NOT_FOUND");
  });

  it("never dispatches against an arbitrary method name — unknown methods are rejected, not invoked", () => {
    const result = parseIncomingMessage(
      { protocol: PROTOCOL_VERSION, kind: "call", id: "abc", method: "__proto__", params: {} },
      "toSession",
    );
    expect(result.ok).toBe(false);
  });
});

describe("exceedsMaxMessageSize / parseRawSocketMessage — oversized message", () => {
  it("flags a payload larger than the 64 KiB limit", () => {
    expect(exceedsMaxMessageSize(MAX_MESSAGE_BYTES + 1)).toBe(true);
    expect(exceedsMaxMessageSize(MAX_MESSAGE_BYTES)).toBe(false);
  });

  it("rejects an oversized raw socket message before attempting to parse it", () => {
    const oversizedParams = "x".repeat(MAX_MESSAGE_BYTES + 1000);
    const raw = JSON.stringify({
      protocol: PROTOCOL_VERSION,
      kind: "call",
      id: "abc",
      method: "recordEvent",
      params: oversizedParams,
    });
    const result = parseRawSocketMessage(raw, "toSession");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MESSAGE_TOO_LARGE");
  });

  it("accepts a well-formed, appropriately sized raw socket message", () => {
    // params: null, not undefined — JSON has no `undefined`, and JSON.stringify silently
    // drops object properties whose value is undefined, which would make this test not
    // actually exercise the "params key present" path it's meant to.
    const raw = JSON.stringify({
      protocol: PROTOCOL_VERSION,
      kind: "call",
      id: "abc",
      method: "getSnapshot",
      params: null,
    });
    const result = parseRawSocketMessage(raw, "toSession");
    expect(result.ok).toBe(true);
  });

  it("rejects malformed JSON", () => {
    const result = parseRawSocketMessage("{not valid json", "toSession");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_MESSAGE");
  });
});
