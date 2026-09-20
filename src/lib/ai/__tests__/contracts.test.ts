import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiInsightKind as PrismaAiInsightKind } from "@/generated/prisma/client";
import {
  AI_CONTRACT_VERSION,
  MAX_INSIGHTS,
  AI_INSIGHT_KIND_WIRE_VALUES,
  toPrismaAiInsightKind,
  advisorInsightSchema,
  advisorResponseSchema,
  confirmDevelopmentObservationActionSchema,
  EPHEMERAL_REF_PATTERN,
  EVIDENCE_REF_PATTERN,
  ADVISOR_RESPONSE_JSON_SCHEMA,
} from "@/lib/ai/contracts";

function validInsight(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: "observation",
    subjectRef: "P03",
    secondarySubjectRef: null,
    title: "Position exposure",
    body: "The supplied match data shows a recurring pattern.",
    evidenceRefs: ["fact:position-exposure:P03"],
    suggestedAction: null,
    ...overrides,
  };
}

function validResponse(insights: unknown[] = [validInsight()]) {
  return { contractVersion: AI_CONTRACT_VERSION, summary: "Concise advisory summary.", insights };
}

describe("ai/contracts: ephemeral ref pattern", () => {
  it.each(["P01", "P02", "M01", "T99", "P0123"])("accepts %s", (ref) => {
    expect(EPHEMERAL_REF_PATTERN.test(ref)).toBe(true);
  });

  it.each(["p01", "P1", "PLAYER01", "cm2abcdefghijklmnopqrs", ""])("rejects %s", (ref) => {
    expect(EPHEMERAL_REF_PATTERN.test(ref)).toBe(false);
  });
});

describe("ai/contracts: evidence ref pattern", () => {
  it.each([
    "fact:opportunity:P01:week",
    "fact:planned-position:P03:slot-2",
    "fact:actual-position:P04:interval-3",
    "fact:round-allocation:P02",
    "fact:sporting-fit:M01",
  ])("accepts %s", (ref) => {
    expect(EVIDENCE_REF_PATTERN.test(ref)).toBe(true);
  });

  it.each(["opportunity:P01", "fact:", "fact:Opportunity:P01", ""])("rejects %s", (ref) => {
    expect(EVIDENCE_REF_PATTERN.test(ref)).toBe(false);
  });
});

describe("ai/contracts: toPrismaAiInsightKind", () => {
  it("maps every wire kind to its exact Prisma enum value", () => {
    expect(toPrismaAiInsightKind("observation")).toBe(PrismaAiInsightKind.OBSERVATION);
    expect(toPrismaAiInsightKind("attention")).toBe(PrismaAiInsightKind.ATTENTION);
    expect(toPrismaAiInsightKind("opportunity")).toBe(PrismaAiInsightKind.OPPORTUNITY);
    expect(toPrismaAiInsightKind("development_suggestion")).toBe(PrismaAiInsightKind.DEVELOPMENT_SUGGESTION);
  });

  it("has exactly the four locked insight kinds, no more, no fewer", () => {
    expect([...AI_INSIGHT_KIND_WIRE_VALUES].sort()).toEqual(
      ["observation", "attention", "opportunity", "development_suggestion"].sort(),
    );
  });
});

describe("ai/contracts: confirmDevelopmentObservationActionSchema", () => {
  it("accepts a well-formed action", () => {
    const result = confirmDevelopmentObservationActionSchema.safeParse({
      type: "confirm_development_observation",
      playerRef: "P03",
      category: "technical",
      observation: "Consistently strong first touch under pressure.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a wrong discriminant type", () => {
    const result = confirmDevelopmentObservationActionSchema.safeParse({
      type: "something_else",
      playerRef: "P03",
      category: "technical",
      observation: "x",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ephemeral playerRef", () => {
    const result = confirmDevelopmentObservationActionSchema.safeParse({
      type: "confirm_development_observation",
      playerRef: "cm2abcdefghijklmnopqrs",
      category: "technical",
      observation: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("ai/contracts: advisorInsightSchema", () => {
  it("accepts the documented example shape", () => {
    expect(advisorInsightSchema.safeParse(validInsight()).success).toBe(true);
  });

  it("accepts every locked insight kind", () => {
    for (const kind of AI_INSIGHT_KIND_WIRE_VALUES) {
      expect(advisorInsightSchema.safeParse(validInsight({ kind })).success).toBe(true);
    }
  });

  it("rejects an unknown kind", () => {
    expect(advisorInsightSchema.safeParse(validInsight({ kind: "verdict" })).success).toBe(false);
  });

  it("rejects zero evidence refs — every insight must cite at least one fact", () => {
    expect(advisorInsightSchema.safeParse(validInsight({ evidenceRefs: [] })).success).toBe(false);
  });

  it("rejects a malformed evidence ref", () => {
    expect(advisorInsightSchema.safeParse(validInsight({ evidenceRefs: ["not-a-fact-ref"] })).success).toBe(false);
  });

  it("accepts a null subjectRef/secondarySubjectRef (team/round-scoped insights)", () => {
    expect(advisorInsightSchema.safeParse(validInsight({ subjectRef: null })).success).toBe(true);
  });

  it("accepts a well-formed suggestedAction", () => {
    const result = advisorInsightSchema.safeParse(
      validInsight({
        kind: "development_suggestion",
        suggestedAction: {
          type: "confirm_development_observation",
          playerRef: "P03",
          category: "technical",
          observation: "x",
        },
      }),
    );
    expect(result.success).toBe(true);
  });
});

describe("ai/contracts: advisorResponseSchema", () => {
  it("accepts a well-formed response", () => {
    expect(advisorResponseSchema.safeParse(validResponse()).success).toBe(true);
  });

  it("accepts an empty insights array", () => {
    expect(advisorResponseSchema.safeParse(validResponse([])).success).toBe(true);
  });

  it(`rejects more than ${MAX_INSIGHTS} insights`, () => {
    const tooMany = Array.from({ length: MAX_INSIGHTS + 1 }, () => validInsight());
    expect(advisorResponseSchema.safeParse(validResponse(tooMany)).success).toBe(false);
  });

  it(`accepts exactly ${MAX_INSIGHTS} insights`, () => {
    const exactly = Array.from({ length: MAX_INSIGHTS }, () => validInsight());
    expect(advisorResponseSchema.safeParse(validResponse(exactly)).success).toBe(true);
  });

  it("rejects a contractVersion other than the locked current version", () => {
    expect(advisorResponseSchema.safeParse({ ...validResponse(), contractVersion: "2" }).success).toBe(false);
  });

  it("rejects a response containing one malformed insight, not just that insight", () => {
    const result = advisorResponseSchema.safeParse(validResponse([validInsight(), validInsight({ kind: "bogus" })]));
    expect(result.success).toBe(false);
  });
});

describe("ai/contracts: ADVISOR_RESPONSE_JSON_SCHEMA", () => {
  it("is a strict object schema — every top-level field required, no additional properties", () => {
    expect(ADVISOR_RESPONSE_JSON_SCHEMA.type).toBe("object");
    expect(ADVISOR_RESPONSE_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(ADVISOR_RESPONSE_JSON_SCHEMA.required).toEqual(
      expect.arrayContaining(["contractVersion", "summary", "insights"]),
    );
  });

  it("caps insights at MAX_INSIGHTS in the generated schema too", () => {
    const insightsProperty = ADVISOR_RESPONSE_JSON_SCHEMA.properties?.insights as { maxItems?: number } | undefined;
    expect(insightsProperty?.maxItems).toBe(MAX_INSIGHTS);
  });
});
