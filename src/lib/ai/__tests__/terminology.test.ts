import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AI_TERMINOLOGY_VERSION, AI_ADVISOR_STABLE_DOCTRINE } from "@/lib/ai/terminology";

describe("ai/terminology", () => {
  it("has a non-empty version string", () => {
    expect(AI_TERMINOLOGY_VERSION.length).toBeGreaterThan(0);
  });

  it("states every stable-doctrine rule from 07_EXECUTION_PIPELINE.md", () => {
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/evidence/i);
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/never invent/i);
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/ambition|attitude|commitment|character/i);
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/only the entity references supplied/i);
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/UK football terminology/i);
  });

  it("uses canonical UK spellings/hyphenation for the terms it states directly (not the ones it names as things to avoid)", () => {
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/\bsquad\b/i);
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/\bline-up\b/i);
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/\bmatch\b/i);
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/\bpitch\b/i);
  });

  it("explicitly rules out a real name or database identifier as an acceptable reference", () => {
    expect(AI_ADVISOR_STABLE_DOCTRINE).toMatch(/never use a real name or database identifier/i);
  });
});
