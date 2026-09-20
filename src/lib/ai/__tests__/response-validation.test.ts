import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AI_CONTRACT_VERSION } from "@/lib/ai/contracts";
import {
  parseAdvisorResponse,
  validateAdvisorSemantics,
  validateAdvisorEvidenceRefs,
  validateAdvisorResponse,
} from "@/lib/ai/response-validation";

function insight(overrides: Partial<Record<string, unknown>> = {}) {
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

function response(insights: unknown[] = [insight()]) {
  return { contractVersion: AI_CONTRACT_VERSION, summary: "Concise advisory summary.", insights };
}

describe("ai/response-validation: parseAdvisorResponse (stage 1: schema)", () => {
  it("accepts a well-formed response", () => {
    const result = parseAdvisorResponse(response());
    expect(result.valid).toBe(true);
  });

  it("rejects the whole response for one malformed insight — never salvages the valid ones", () => {
    const result = parseAdvisorResponse(response([insight(), insight({ kind: "not-a-real-kind" })]));
    expect(result).toMatchObject({ valid: false, reason: "SCHEMA_INVALID" });
  });

  it("rejects non-object input without throwing", () => {
    expect(parseAdvisorResponse("not an object").valid).toBe(false);
    expect(parseAdvisorResponse(null).valid).toBe(false);
    expect(parseAdvisorResponse(undefined).valid).toBe(false);
    expect(parseAdvisorResponse(42).valid).toBe(false);
  });

  it("rejects more than 10 insights", () => {
    const tooMany = Array.from({ length: 11 }, () => insight());
    expect(parseAdvisorResponse(response(tooMany)).valid).toBe(false);
  });
});

describe("ai/response-validation: validateAdvisorSemantics (stage 2)", () => {
  it("accepts when every subject ref is in the allowed set", () => {
    const parsed = parseAdvisorResponse(response());
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorSemantics(parsed.response, new Set(["P03"]));
    expect(result.valid).toBe(true);
  });

  it("rejects a subjectRef the provider invented — not one this review actually issued", () => {
    const parsed = parseAdvisorResponse(response([insight({ subjectRef: "P99" })]));
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorSemantics(parsed.response, new Set(["P03"]));
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_SUBJECT_REF" });
  });

  it("rejects an unknown secondarySubjectRef", () => {
    const parsed = parseAdvisorResponse(response([insight({ subjectRef: "P03", secondarySubjectRef: "P77" })]));
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorSemantics(parsed.response, new Set(["P03"]));
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_SUBJECT_REF" });
  });

  it("rejects an unknown suggestedAction.playerRef even when subjectRef is allowed", () => {
    const parsed = parseAdvisorResponse(
      response([
        insight({
          subjectRef: "P03",
          suggestedAction: {
            type: "confirm_development_observation",
            playerRef: "P88",
            category: "technical",
            observation: "x",
          },
        }),
      ]),
    );
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorSemantics(parsed.response, new Set(["P03"]));
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_SUBJECT_REF" });
  });

  it("accepts a null subjectRef without requiring it in the allowed set", () => {
    const parsed = parseAdvisorResponse(response([insight({ subjectRef: null })]));
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorSemantics(parsed.response, new Set());
    expect(result.valid).toBe(true);
  });

  it("rejects a response whose text contains a database-ID-shaped token", () => {
    const parsed = parseAdvisorResponse(
      response([insight({ body: "See record cm2f8x9k3z7q1w4e6r8t0y2u for context." })]),
    );
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorSemantics(parsed.response, new Set(["P03"]));
    expect(result).toMatchObject({ valid: false, reason: "SUSPECTED_LEAKED_IDENTIFIER" });
  });

  it("does not false-positive the leaked-identifier heuristic on ordinary advisory prose", () => {
    const parsed = parseAdvisorResponse(
      response([insight({ body: "This player has shown consistent positional discipline across recent matches." })]),
    );
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorSemantics(parsed.response, new Set(["P03"]));
    expect(result.valid).toBe(true);
  });
});

describe("ai/response-validation: validateAdvisorEvidenceRefs (stage 3)", () => {
  it("accepts when every evidence ref is in the allowed set", () => {
    const parsed = parseAdvisorResponse(response());
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorEvidenceRefs(parsed.response, new Set(["fact:position-exposure:P03"]));
    expect(result.valid).toBe(true);
  });

  it("rejects an evidence ref this review's context never produced", () => {
    const parsed = parseAdvisorResponse(response());
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorEvidenceRefs(parsed.response, new Set(["fact:something-else:P01"]));
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_EVIDENCE_REF" });
  });

  it("rejects if any one of multiple evidence refs is unknown", () => {
    const parsed = parseAdvisorResponse(
      response([insight({ evidenceRefs: ["fact:position-exposure:P03", "fact:unknown-thing:P03"] })]),
    );
    if (!parsed.valid) throw new Error("expected schema-valid fixture");
    const result = validateAdvisorEvidenceRefs(parsed.response, new Set(["fact:position-exposure:P03"]));
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_EVIDENCE_REF" });
  });
});

describe("ai/response-validation: validateAdvisorResponse (all three stages)", () => {
  const allowed = { subjectRefs: new Set(["P03"]), evidenceRefs: new Set(["fact:position-exposure:P03"]) };

  it("accepts a fully valid response end to end", () => {
    const result = validateAdvisorResponse(response(), allowed);
    expect(result.valid).toBe(true);
  });

  it("short-circuits on schema failure before ever checking refs", () => {
    const result = validateAdvisorResponse(response([insight({ kind: "bogus" })]), allowed);
    expect(result).toMatchObject({ valid: false, reason: "SCHEMA_INVALID" });
  });

  it("short-circuits on an unknown subject ref before checking evidence refs", () => {
    const result = validateAdvisorResponse(response([insight({ subjectRef: "P99" })]), allowed);
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_SUBJECT_REF" });
  });

  it("catches an unknown evidence ref once schema and semantics both pass", () => {
    const result = validateAdvisorResponse(
      response([insight({ evidenceRefs: ["fact:not-allowed:P03"] })]),
      allowed,
    );
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_EVIDENCE_REF" });
  });

  it("rejects raw JSON garbage without throwing", () => {
    const result = validateAdvisorResponse("{not valid json at all", allowed);
    expect(result.valid).toBe(false);
  });
});
