import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runStandardProbe } from "@/lib/ai/providers/standard-probe";
import { FakeProviderAdapter } from "@/lib/ai/providers/fake-provider-adapter";

describe("ai/providers/standard-probe: runStandardProbe", () => {
  it("succeeds when executeReview returns a schema-valid response", async () => {
    const adapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
    adapter.setNextExecuteResponse({ contractVersion: "1", summary: "ok", insights: [] });

    const result = await runStandardProbe(adapter, "cred", "fake-model-1");
    expect(result).toEqual({ ok: true });
  });

  it("propagates the adapter's own failure code when executeReview fails", async () => {
    const adapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
    adapter.forceNextExecuteFailure("PROVIDER_AUTH_FAILED");

    const result = await runStandardProbe(adapter, "cred", "fake-model-1");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_AUTH_FAILED" });
  });

  it("fails with PROVIDER_RESPONSE_INVALID when the response doesn't pass schema validation", async () => {
    const adapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
    adapter.setNextExecuteResponse({ not: "the advisor shape at all" });

    const result = await runStandardProbe(adapter, "cred", "fake-model-1");
    expect(result).toEqual({ ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" });
  });

  it("sends the exact synthetic probe instructions and input, never real Matchboard data", async () => {
    const adapter = new FakeProviderAdapter({ id: "openai", label: "OpenAI" });
    await runStandardProbe(adapter, "cred", "fake-model-1");

    expect(adapter.executeReviewCalls).toHaveLength(1);
    const call = adapter.executeReviewCalls[0];
    expect(call.credential).toBe("cred");
    expect(call.model).toBe("fake-model-1");
    expect(call.input).toEqual({
      players: [
        { ref: "P01", minutes: 20 },
        { ref: "P02", minutes: 40 },
      ],
    });
  });
});
