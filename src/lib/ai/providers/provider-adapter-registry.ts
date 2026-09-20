import "server-only";
import type { AiProviderAdapter } from "@/lib/ai/providers/provider-adapter";
import type { AiProviderWireId } from "@/lib/ai/provider-registry";
import { openaiAdapter } from "@/lib/ai/providers/openai";
import { anthropicAdapter } from "@/lib/ai/providers/anthropic";
import { googleGeminiAdapter } from "@/lib/ai/providers/google-gemini";
import { mistralAdapter } from "@/lib/ai/providers/mistral";
import { ollamaCloudAdapter } from "@/lib/ai/providers/ollama-cloud";

/**
 * The complete, fixed 5-adapter registry (03_PROVIDER_ADAPTERS_AND_MODELS.md /
 * provider-registry.ts). This is the concrete adapter instance counterpart to
 * `AI_PROVIDER_REGISTRY` (the static metadata registry) — callers needing to actually invoke a
 * provider go through here, not through a hand-picked import of one adapter module.
 */
export const PROVIDER_ADAPTER_REGISTRY: Record<AiProviderWireId, AiProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  google_gemini: googleGeminiAdapter,
  mistral: mistralAdapter,
  ollama_cloud: ollamaCloudAdapter,
};

export function getProviderAdapter(wireId: AiProviderWireId): AiProviderAdapter {
  return PROVIDER_ADAPTER_REGISTRY[wireId];
}
