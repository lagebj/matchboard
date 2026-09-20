import "server-only";
import type {
  AiProviderAdapter,
  ProviderModel,
  ProviderListModelsResult,
  ProviderProbeResult,
  ProviderExecuteRequest,
  ProviderExecuteResult,
  ProviderErrorCode,
} from "@/lib/ai/providers/provider-adapter";
import type { AiProviderWireId } from "@/lib/ai/provider-registry";

/**
 * In-memory fake adapter for pipeline tests that need a working `AiProviderAdapter` without a
 * real provider — mirrors `FakeMatchboardSecurityTransport`'s shape (seed known-good state,
 * capture calls, force failures on demand). Per the bundle's own test doctrine
 * (09_TEST_AND_ACCEPTANCE.md): "Add E2E coverage... using fake security/provider transports.
 * Never use a real provider credential in CI."
 */
export class FakeProviderAdapter implements AiProviderAdapter {
  readonly id: AiProviderWireId;
  readonly label: string;
  readonly credentialLabel = "API key";
  readonly supportsStructuredOutput: boolean;

  readonly listModelsCalls: string[] = [];
  readonly probeModelCalls: { credential: string; modelId: string }[] = [];
  readonly executeReviewCalls: ProviderExecuteRequest[] = [];

  private models: ProviderModel[] = [{ id: "fake-model-1" }];
  private probeableModelIds = new Set(["fake-model-1"]);
  private nextExecuteResponse: unknown = { contractVersion: "1", summary: "Fake summary.", insights: [] };
  private forcedListModelsFailure: ProviderErrorCode | null = null;
  private forcedProbeFailure: ProviderErrorCode | null = null;
  private forcedExecuteFailure: ProviderErrorCode | null = null;

  constructor(params: { id: AiProviderWireId; label: string; supportsStructuredOutput?: boolean }) {
    this.id = params.id;
    this.label = params.label;
    this.supportsStructuredOutput = params.supportsStructuredOutput ?? true;
  }

  setModels(models: ProviderModel[]): void {
    this.models = models;
  }

  setProbeableModelIds(ids: string[]): void {
    this.probeableModelIds = new Set(ids);
  }

  setNextExecuteResponse(raw: unknown): void {
    this.nextExecuteResponse = raw;
  }

  forceNextListModelsFailure(errorCode: ProviderErrorCode): void {
    this.forcedListModelsFailure = errorCode;
  }

  forceNextProbeFailure(errorCode: ProviderErrorCode): void {
    this.forcedProbeFailure = errorCode;
  }

  forceNextExecuteFailure(errorCode: ProviderErrorCode): void {
    this.forcedExecuteFailure = errorCode;
  }

  async listModels(credential: string): Promise<ProviderListModelsResult> {
    this.listModelsCalls.push(credential);
    if (this.forcedListModelsFailure) {
      const errorCode = this.forcedListModelsFailure;
      this.forcedListModelsFailure = null;
      return { ok: false, errorCode };
    }
    return { ok: true, models: this.models };
  }

  async probeModel(credential: string, modelId: string): Promise<ProviderProbeResult> {
    this.probeModelCalls.push({ credential, modelId });
    if (this.forcedProbeFailure) {
      const errorCode = this.forcedProbeFailure;
      this.forcedProbeFailure = null;
      return { ok: false, errorCode };
    }
    if (!this.probeableModelIds.has(modelId)) {
      return { ok: false, errorCode: "PROVIDER_RESPONSE_INVALID" };
    }
    return { ok: true };
  }

  async executeReview(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
    this.executeReviewCalls.push(request);
    if (this.forcedExecuteFailure) {
      const errorCode = this.forcedExecuteFailure;
      this.forcedExecuteFailure = null;
      return { ok: false, errorCode, durationMs: 1 };
    }
    return { ok: true, raw: this.nextExecuteResponse, inputTokens: 10, outputTokens: 20, durationMs: 1 };
  }
}
