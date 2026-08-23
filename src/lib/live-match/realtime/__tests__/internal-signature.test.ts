import { describe, it, expect } from "vitest";
import { signInternalRequest, verifyInternalSignature } from "../internal-signature";

const SECRET = "internal-test-secret-do-not-use-in-real-env";
const OTHER_SECRET = "a-completely-different-secret-value";

describe("signInternalRequest / verifyInternalSignature (SPEC.md §18)", () => {
  it("verifies a signature computed with the same secret, timestamp, and body", async () => {
    const timestamp = 1_700_000_000_000;
    const rawBody = JSON.stringify({ hello: "world" });
    const signature = await signInternalRequest({ timestamp, rawBody, secret: SECRET });

    const result = await verifyInternalSignature({ timestamp, rawBody, signature, secret: SECRET, now: timestamp });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a tampered body — the signature no longer matches", async () => {
    const timestamp = 1_700_000_000_000;
    const signature = await signInternalRequest({ timestamp, rawBody: JSON.stringify({ hello: "world" }), secret: SECRET });

    const result = await verifyInternalSignature({
      timestamp,
      rawBody: JSON.stringify({ hello: "tampered" }),
      signature,
      secret: SECRET,
      now: timestamp,
    });
    expect(result).toEqual({ ok: false, reason: "INVALID_SIGNATURE" });
  });

  it("rejects a signature computed with a different secret", async () => {
    const timestamp = 1_700_000_000_000;
    const rawBody = JSON.stringify({ hello: "world" });
    const signature = await signInternalRequest({ timestamp, rawBody, secret: OTHER_SECRET });

    const result = await verifyInternalSignature({ timestamp, rawBody, signature, secret: SECRET, now: timestamp });
    expect(result).toEqual({ ok: false, reason: "INVALID_SIGNATURE" });
  });

  it("rejects a timestamp outside the default 60-second tolerance", async () => {
    const timestamp = 1_700_000_000_000;
    const rawBody = JSON.stringify({ hello: "world" });
    const signature = await signInternalRequest({ timestamp, rawBody, secret: SECRET });

    const tooLate = await verifyInternalSignature({
      timestamp,
      rawBody,
      signature,
      secret: SECRET,
      now: timestamp + 61_000,
    });
    expect(tooLate).toEqual({ ok: false, reason: "STALE_TIMESTAMP" });

    const tooEarly = await verifyInternalSignature({
      timestamp,
      rawBody,
      signature,
      secret: SECRET,
      now: timestamp - 61_000,
    });
    expect(tooEarly).toEqual({ ok: false, reason: "STALE_TIMESTAMP" });
  });

  it("accepts a timestamp exactly at the tolerance boundary", async () => {
    const timestamp = 1_700_000_000_000;
    const rawBody = JSON.stringify({ hello: "world" });
    const signature = await signInternalRequest({ timestamp, rawBody, secret: SECRET });

    const result = await verifyInternalSignature({
      timestamp,
      rawBody,
      signature,
      secret: SECRET,
      now: timestamp + 60_000,
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects a signature of the wrong length outright (constant-time compare's safe short-circuit)", async () => {
    const timestamp = 1_700_000_000_000;
    const rawBody = "";
    const result = await verifyInternalSignature({
      timestamp,
      rawBody,
      signature: "not-a-real-signature",
      secret: SECRET,
      now: timestamp,
    });
    expect(result).toEqual({ ok: false, reason: "INVALID_SIGNATURE" });
  });

  it("signs and verifies an empty body (GET snapshot request shape)", async () => {
    const timestamp = 1_700_000_000_000;
    const signature = await signInternalRequest({ timestamp, rawBody: "", secret: SECRET });
    const result = await verifyInternalSignature({ timestamp, rawBody: "", signature, secret: SECRET, now: timestamp });
    expect(result).toEqual({ ok: true });
  });
});
