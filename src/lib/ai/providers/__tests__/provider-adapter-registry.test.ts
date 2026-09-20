import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AI_PROVIDER_WIRE_IDS } from "@/lib/ai/provider-registry";
import { PROVIDER_ADAPTER_REGISTRY, getProviderAdapter } from "@/lib/ai/providers/provider-adapter-registry";

describe("ai/providers/provider-adapter-registry", () => {
  it("has a concrete adapter for every locked wire provider ID", () => {
    for (const id of AI_PROVIDER_WIRE_IDS) {
      const adapter = PROVIDER_ADAPTER_REGISTRY[id];
      expect(adapter.id).toBe(id);
      expect(getProviderAdapter(id)).toBe(adapter);
    }
  });

  it("exactly Ollama Cloud lacks structured output support", () => {
    const unsupported = AI_PROVIDER_WIRE_IDS.filter((id) => !PROVIDER_ADAPTER_REGISTRY[id].supportsStructuredOutput);
    expect(unsupported).toEqual(["ollama_cloud"]);
  });

  it("every adapter exposes listModels/probeModel/executeReview", () => {
    for (const id of AI_PROVIDER_WIRE_IDS) {
      const adapter = PROVIDER_ADAPTER_REGISTRY[id];
      expect(typeof adapter.listModels).toBe("function");
      expect(typeof adapter.probeModel).toBe("function");
      expect(typeof adapter.executeReview).toBe("function");
    }
  });
});
