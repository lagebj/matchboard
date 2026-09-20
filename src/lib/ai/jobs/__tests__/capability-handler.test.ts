import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  registerAiCapabilityHandler,
  getAiCapabilityHandler,
  resetAiCapabilityHandlers,
  type AiCapabilityHandler,
} from "@/lib/ai/jobs/capability-handler";

afterEach(() => {
  resetAiCapabilityHandlers();
});

function fakeHandler(capability: AiCapabilityHandler["capability"]): AiCapabilityHandler {
  return {
    capability,
    buildContext: async () => ({
      normalizedContext: {},
      instructions: "x",
      refMap: new Map(),
      evidenceRefs: new Set(),
    }),
  };
}

describe("ai/jobs/capability-handler", () => {
  it("returns undefined for an unregistered capability", () => {
    expect(getAiCapabilityHandler("ROUND_REVIEW")).toBeUndefined();
  });

  it("returns the handler once registered", () => {
    const handler = fakeHandler("ROUND_REVIEW");
    registerAiCapabilityHandler(handler);
    expect(getAiCapabilityHandler("ROUND_REVIEW")).toBe(handler);
  });

  it("keeps handlers for different capabilities independent", () => {
    const round = fakeHandler("ROUND_REVIEW");
    const lineup = fakeHandler("LINEUP_REVIEW");
    registerAiCapabilityHandler(round);
    registerAiCapabilityHandler(lineup);

    expect(getAiCapabilityHandler("ROUND_REVIEW")).toBe(round);
    expect(getAiCapabilityHandler("LINEUP_REVIEW")).toBe(lineup);
    expect(getAiCapabilityHandler("MATCH_PREP")).toBeUndefined();
  });

  it("a later registration for the same capability replaces the earlier one", () => {
    const first = fakeHandler("ROUND_REVIEW");
    const second = fakeHandler("ROUND_REVIEW");
    registerAiCapabilityHandler(first);
    registerAiCapabilityHandler(second);
    expect(getAiCapabilityHandler("ROUND_REVIEW")).toBe(second);
  });

  it("resetAiCapabilityHandlers clears every registration", () => {
    registerAiCapabilityHandler(fakeHandler("ROUND_REVIEW"));
    resetAiCapabilityHandlers();
    expect(getAiCapabilityHandler("ROUND_REVIEW")).toBeUndefined();
  });
});
