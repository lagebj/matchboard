import { describe, it, expect } from "vitest";
import { AiProviderId as PrismaAiProviderId } from "@/generated/prisma/client";
import {
  AI_PROVIDER_WIRE_IDS,
  AI_PROVIDER_REGISTRY,
  isAiProviderWireId,
  toPrismaAiProviderId,
  fromPrismaAiProviderId,
  getAiProviderDefinition,
  listAiProviderDefinitions,
} from "@/lib/ai/provider-registry";

describe("ai/provider-registry", () => {
  it("has exactly the five locked provider IDs, no more, no fewer", () => {
    expect([...AI_PROVIDER_WIRE_IDS].sort()).toEqual(
      ["anthropic", "google_gemini", "mistral", "ollama_cloud", "openai"].sort(),
    );
  });

  it("registers a definition for every wire ID with no organisation-configurable base URL", () => {
    for (const id of AI_PROVIDER_WIRE_IDS) {
      const def = AI_PROVIDER_REGISTRY[id];
      expect(def.id).toBe(id);
      expect(def.baseUrl).toMatch(/^https:\/\//);
      expect(getAiProviderDefinition(id)).toBe(def);
    }
    expect(listAiProviderDefinitions()).toHaveLength(5);
  });

  it("marks Ollama Cloud, and only Ollama Cloud, as not supporting structured output", () => {
    const unsupported = listAiProviderDefinitions().filter((d) => !d.supportsStructuredOutput);
    expect(unsupported.map((d) => d.id)).toEqual(["ollama_cloud"]);
  });

  it("round-trips every wire ID through the Prisma enum and back", () => {
    for (const id of AI_PROVIDER_WIRE_IDS) {
      const prismaId = toPrismaAiProviderId(id);
      expect(fromPrismaAiProviderId(prismaId)).toBe(id);
    }
  });

  it("maps each wire ID to its exact Prisma enum value", () => {
    expect(toPrismaAiProviderId("openai")).toBe(PrismaAiProviderId.OPENAI);
    expect(toPrismaAiProviderId("anthropic")).toBe(PrismaAiProviderId.ANTHROPIC);
    expect(toPrismaAiProviderId("google_gemini")).toBe(PrismaAiProviderId.GOOGLE_GEMINI);
    expect(toPrismaAiProviderId("mistral")).toBe(PrismaAiProviderId.MISTRAL);
    expect(toPrismaAiProviderId("ollama_cloud")).toBe(PrismaAiProviderId.OLLAMA_CLOUD);
  });

  it("isAiProviderWireId accepts only the five canonical lowercase IDs", () => {
    for (const id of AI_PROVIDER_WIRE_IDS) {
      expect(isAiProviderWireId(id)).toBe(true);
    }
    expect(isAiProviderWireId("OPENAI")).toBe(false);
    expect(isAiProviderWireId("azure_openai")).toBe(false);
    expect(isAiProviderWireId("")).toBe(false);
    expect(isAiProviderWireId("openai-compatible")).toBe(false);
  });
});
