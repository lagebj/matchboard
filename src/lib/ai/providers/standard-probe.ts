import "server-only";
import type { AiProviderAdapter, ProviderProbeResult } from "@/lib/ai/providers/provider-adapter";
import { SYNTHETIC_PROBE_INSTRUCTIONS, SYNTHETIC_PROBE_INPUT } from "@/lib/ai/providers/provider-adapter";
import { parseAdvisorResponse } from "@/lib/ai/response-validation";

/**
 * Shared `probeModel()` implementation for every adapter with native structured-output support
 * (everything except Ollama Cloud, which needs its own repair-retry variant). Runs the synthetic
 * capability probe through the adapter's own `executeReview()` and checks the result against
 * stage 1 (schema) of the shared response validator — no semantic/evidence-ref validation
 * applies to synthetic probe data, since it was never issued real ephemeral/evidence refs.
 */
export async function runStandardProbe(adapter: AiProviderAdapter, credential: string, modelId: string): Promise<ProviderProbeResult> {
  const result = await adapter.executeReview({
    credential,
    model: modelId,
    instructions: SYNTHETIC_PROBE_INSTRUCTIONS,
    input: SYNTHETIC_PROBE_INPUT,
  });

  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode };
  }

  const validation = parseAdvisorResponse(result.raw);
  if (!validation.valid) {
    return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };
  }

  return { ok: true };
}
