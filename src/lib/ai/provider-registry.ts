import "server-only";
import { AiProviderId as PrismaAiProviderId } from "@/generated/prisma/client";

/**
 * Fixed, code-owned AI provider registry (ADR-0148 / 01_LOCKED_DECISIONS.md /
 * 03_PROVIDER_ADAPTERS_AND_MODELS.md). Exactly five production adapters. No organisation ever
 * supplies a base URL — every host below is a literal, never interpolated from configuration.
 *
 * Two parallel ID spaces exist by design, not by accident:
 * - the Prisma `AiProviderId` enum (`OPENAI`, ...) is the persisted, DB-facing form;
 * - the lowercase-snake wire ID (`openai`, ...) is what the bundle's security-boundary contract
 *   (JWT `provider` claims, the enrollment request body) and every provider's own documentation
 *   actually use. `AI_PROVIDER_REGISTRY` is keyed by the wire ID; `toPrismaAiProviderId` /
 *   `fromPrismaAiProviderId` convert between the two. Never hand-roll this mapping elsewhere.
 */
export const AI_PROVIDER_WIRE_IDS = ["openai", "anthropic", "google_gemini", "mistral", "ollama_cloud"] as const;

export type AiProviderWireId = (typeof AI_PROVIDER_WIRE_IDS)[number];

export function isAiProviderWireId(value: string): value is AiProviderWireId {
  return (AI_PROVIDER_WIRE_IDS as readonly string[]).includes(value);
}

const WIRE_TO_PRISMA: Record<AiProviderWireId, PrismaAiProviderId> = {
  openai: PrismaAiProviderId.OPENAI,
  anthropic: PrismaAiProviderId.ANTHROPIC,
  google_gemini: PrismaAiProviderId.GOOGLE_GEMINI,
  mistral: PrismaAiProviderId.MISTRAL,
  ollama_cloud: PrismaAiProviderId.OLLAMA_CLOUD,
};

const PRISMA_TO_WIRE: Record<PrismaAiProviderId, AiProviderWireId> = {
  [PrismaAiProviderId.OPENAI]: "openai",
  [PrismaAiProviderId.ANTHROPIC]: "anthropic",
  [PrismaAiProviderId.GOOGLE_GEMINI]: "google_gemini",
  [PrismaAiProviderId.MISTRAL]: "mistral",
  [PrismaAiProviderId.OLLAMA_CLOUD]: "ollama_cloud",
};

export function toPrismaAiProviderId(wireId: AiProviderWireId): PrismaAiProviderId {
  return WIRE_TO_PRISMA[wireId];
}

export function fromPrismaAiProviderId(prismaId: PrismaAiProviderId): AiProviderWireId {
  return PRISMA_TO_WIRE[prismaId];
}

/** Authentication shape an adapter must use — every provider below uses exactly one of these,
 * never an organisation-chosen alternative. */
export type AiProviderAuthStyle =
  | { kind: "bearer" }
  | { kind: "bearer-with-header"; header: string; value: string }
  | { kind: "header"; header: string };

export interface AiProviderDefinition {
  id: AiProviderWireId;
  label: string;
  /** Fixed production host. Never organisation-configured — see ADR-0148 §2. */
  baseUrl: string;
  auth: AiProviderAuthStyle;
  modelDiscovery: { method: "GET"; path: string };
  /** Endpoint used for both the synthetic capability probe and real review execution — same
   * request shape, different input, per 03_PROVIDER_ADAPTERS_AND_MODELS.md. `path` is a literal
   * unless it embeds `{model}`, which the adapter substitutes with the selected model ID. */
  execution: { method: "POST"; path: string };
  /** Whether this provider's execution endpoint accepts a server-enforced JSON-schema response
   * format. Ollama Cloud is the sole exception — see 03_PROVIDER_ADAPTERS_AND_MODELS.md's V1
   * Ollama Cloud execution contract (prompt-constrained JSON + local validation + one repair retry). */
  supportsStructuredOutput: boolean;
}

export const AI_PROVIDER_REGISTRY: Record<AiProviderWireId, AiProviderDefinition> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com",
    auth: { kind: "bearer" },
    modelDiscovery: { method: "GET", path: "/v1/models" },
    execution: { method: "POST", path: "/v1/responses" },
    supportsStructuredOutput: true,
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic / Claude",
    baseUrl: "https://api.anthropic.com",
    // Anthropic also supports a legacy `x-api-key` form; Matchboard uses one consistent
    // auth form (Authorization: Bearer) per 03_PROVIDER_ADAPTERS_AND_MODELS.md.
    auth: { kind: "bearer-with-header", header: "anthropic-version", value: "2023-06-01" },
    modelDiscovery: { method: "GET", path: "/v1/models" },
    execution: { method: "POST", path: "/v1/messages" },
    supportsStructuredOutput: true,
  },
  google_gemini: {
    id: "google_gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    auth: { kind: "header", header: "x-goog-api-key" },
    // Filtered to entries whose supported generation methods include `generateContent` —
    // enforced by the adapter, not expressible in this static registry.
    modelDiscovery: { method: "GET", path: "/v1beta/models" },
    execution: { method: "POST", path: "/v1beta/models/{model}:generateContent" },
    supportsStructuredOutput: true,
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI",
    baseUrl: "https://api.mistral.ai",
    auth: { kind: "bearer" },
    // Filtered to non-archived, chat-capable models — enforced by the adapter.
    modelDiscovery: { method: "GET", path: "/v1/models" },
    execution: { method: "POST", path: "/v1/chat/completions" },
    supportsStructuredOutput: true,
  },
  ollama_cloud: {
    id: "ollama_cloud",
    label: "Ollama Cloud",
    baseUrl: "https://ollama.com/api",
    auth: { kind: "bearer" },
    modelDiscovery: { method: "GET", path: "/api/tags" },
    execution: { method: "POST", path: "/api/chat" },
    supportsStructuredOutput: false,
  },
};

export function getAiProviderDefinition(wireId: AiProviderWireId): AiProviderDefinition {
  return AI_PROVIDER_REGISTRY[wireId];
}

export function listAiProviderDefinitions(): AiProviderDefinition[] {
  return AI_PROVIDER_WIRE_IDS.map((id) => AI_PROVIDER_REGISTRY[id]);
}
