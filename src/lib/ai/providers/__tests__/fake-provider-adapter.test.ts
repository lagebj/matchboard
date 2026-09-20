import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakeProviderAdapter } from "@/lib/ai/providers/fake-provider-adapter";

describe("ai/providers/fake-provider-adapter", () => {
  it("lists a default model and records the call", async () => {
    const adapter = new FakeProviderAdapter({ id: "mistral", label: "Mistral AI" });
    const result = await adapter.listModels("cred");
    expect(result).toEqual({ ok: true, models: [{ id: "fake-model-1" }] });
    expect(adapter.listModelsCalls).toEqual(["cred"]);
  });

  it("forceNextListModelsFailure fails exactly the next call", async () => {
    const adapter = new FakeProviderAdapter({ id: "mistral", label: "Mistral AI" });
    adapter.forceNextListModelsFailure("PROVIDER_UNAVAILABLE");

    expect(await adapter.listModels("cred")).toEqual({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });
    expect(await adapter.listModels("cred")).toEqual({ ok: true, models: [{ id: "fake-model-1" }] });
  });

  it("probeModel succeeds only for a model registered as probeable", async () => {
    const adapter = new FakeProviderAdapter({ id: "mistral", label: "Mistral AI" });
    expect(await adapter.probeModel("cred", "fake-model-1")).toEqual({ ok: true });
    expect((await adapter.probeModel("cred", "unknown-model")).ok).toBe(false);
  });

  it("executeReview returns the configured fake response and records the request", async () => {
    const adapter = new FakeProviderAdapter({ id: "mistral", label: "Mistral AI" });
    adapter.setNextExecuteResponse({ contractVersion: "1", summary: "custom", insights: [] });

    const result = await adapter.executeReview({ credential: "cred", model: "fake-model-1", instructions: "x", input: {} });
    expect(result).toMatchObject({ ok: true, raw: { contractVersion: "1", summary: "custom", insights: [] } });
    expect(adapter.executeReviewCalls).toHaveLength(1);
  });

  it("forceNextExecuteFailure fails exactly the next call", async () => {
    const adapter = new FakeProviderAdapter({ id: "mistral", label: "Mistral AI" });
    adapter.forceNextExecuteFailure("PROVIDER_RATE_LIMITED");

    const first = await adapter.executeReview({ credential: "c", model: "m", instructions: "x", input: {} });
    expect(first).toMatchObject({ ok: false, errorCode: "PROVIDER_RATE_LIMITED" });

    const second = await adapter.executeReview({ credential: "c", model: "m", instructions: "x", input: {} });
    expect(second.ok).toBe(true);
  });
});
