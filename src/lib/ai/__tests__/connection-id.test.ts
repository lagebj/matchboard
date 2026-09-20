import { describe, it, expect } from "vitest";
import { generateAiProviderConnectionId, isValidAiProviderConnectionId } from "@/lib/ai/connection-id";

describe("ai/connection-id", () => {
  it("generates IDs with the aic_ prefix that validate as well-formed", () => {
    const id = generateAiProviderConnectionId();
    expect(id.startsWith("aic_")).toBe(true);
    expect(isValidAiProviderConnectionId(id)).toBe(true);
  });

  it("generates URL-safe IDs with no base64 padding or unsafe characters", () => {
    const id = generateAiProviderConnectionId();
    expect(id).toMatch(/^aic_[A-Za-z0-9_-]+$/);
    expect(id).not.toContain("=");
    expect(id).not.toContain("+");
    expect(id).not.toContain("/");
  });

  it("generates at least 128 bits of randomness worth of ID material", () => {
    const id = generateAiProviderConnectionId();
    // base64url encodes 6 bits/char; the random suffix must be long enough to encode >=128 bits.
    const randomPart = id.slice("aic_".length);
    expect(randomPart.length * 6).toBeGreaterThanOrEqual(128);
  });

  it("generates distinct IDs across repeated calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateAiProviderConnectionId()));
    expect(ids.size).toBe(200);
  });

  it("rejects values without the aic_ prefix", () => {
    expect(isValidAiProviderConnectionId("cuid1234567890abcdef")).toBe(false);
    expect(isValidAiProviderConnectionId("")).toBe(false);
  });

  it("rejects a too-short suffix even with the correct prefix", () => {
    expect(isValidAiProviderConnectionId("aic_short")).toBe(false);
  });

  it("rejects unsafe characters in the suffix", () => {
    expect(isValidAiProviderConnectionId("aic_has spaces and stuff")).toBe(false);
    expect(isValidAiProviderConnectionId("aic_has/slash/chars/inside/here")).toBe(false);
  });
});
