import { describe, it, expect } from "vitest";
import { isConfiguredApprover, loadVisualAuthorityConfig } from "../visual-authority-config.mjs";

describe("loadVisualAuthorityConfig", () => {
  it("loads the repository-controlled allowlist and includes the known repository owner", () => {
    const config = loadVisualAuthorityConfig();
    expect(config.approvers).toContain("lagebj");
  });
});

describe("isConfiguredApprover", () => {
  it("accepts an actor on the allowlist", () => {
    expect(isConfiguredApprover("lagebj", { approvers: ["lagebj"] })).toBe(true);
  });

  it("rejects an actor not on the allowlist, even with a plausible-looking login", () => {
    expect(isConfiguredApprover("some-other-writer", { approvers: ["lagebj"] })).toBe(false);
  });

  it("is case-sensitive about GitHub logins as configured (no normalization invented)", () => {
    expect(isConfiguredApprover("LageBJ", { approvers: ["lagebj"] })).toBe(false);
  });

  it("rejects everyone when the allowlist is empty", () => {
    expect(isConfiguredApprover("lagebj", { approvers: [] })).toBe(false);
  });
});
