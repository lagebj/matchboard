import { describe, it, expect } from "vitest";
import { evaluateGate } from "../evaluate-gate.mjs";

const HEAD = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const OLD = "0000000000000000000000000000000000000000";
const alwaysPrivileged = () => true;
const neverPrivileged = () => false;
const noFingerprint = () => null;

function base(overrides: Partial<Parameters<typeof evaluateGate>[0]> = {}) {
  return {
    applicable: true,
    headSha: HEAD,
    comments: [],
    isActorPrivileged: alwaysPrivileged,
    currentFingerprint: "fp-current",
    fingerprintAtSha: noFingerprint,
    ...overrides,
  };
}

describe("evaluateGate", () => {
  it("reports NOT_APPLICABLE when the classifier says not applicable, regardless of comments", () => {
    const result = evaluateGate(base({ applicable: false, comments: [{ body: "/visual-approve " + HEAD, user: "x", createdAt: "t", id: 1 }] }));
    expect(result.state).toBe("NOT_APPLICABLE");
    expect(result.conclusion).toBe("success");
  });

  it("reports AWAITING_APPROVAL when applicable with no comments at all", () => {
    const result = evaluateGate(base());
    expect(result.state).toBe("AWAITING_APPROVAL");
    expect(result.conclusion).toBe("neutral");
  });

  it("reports AWAITING_APPROVAL when the only approve comment is from a non-privileged actor", () => {
    const result = evaluateGate(
      base({
        comments: [{ body: `/visual-approve ${HEAD}`, user: "random", createdAt: "t", id: 1 }],
        isActorPrivileged: neverPrivileged,
      }),
    );
    expect(result.state).toBe("AWAITING_APPROVAL");
  });

  it("reports APPROVED for a privileged approve at the exact head SHA", () => {
    const result = evaluateGate(
      base({ comments: [{ body: `/visual-approve ${HEAD}`, user: "owner", createdAt: "t", id: 1 }] }),
    );
    expect(result.state).toBe("APPROVED");
    expect(result.conclusion).toBe("success");
    expect(result.summary).toContain("owner");
  });

  it("reports INVALID for a privileged approve at an old SHA with no matching fingerprint", () => {
    const result = evaluateGate(
      base({ comments: [{ body: `/visual-approve ${OLD}`, user: "owner", createdAt: "t", id: 1 }] }),
    );
    expect(result.state).toBe("INVALID");
    expect(result.conclusion).toBe("failure");
  });

  it("reports APPROVED for a privileged approve at an old SHA whose fingerprint matches the current one (doc-only follow-up)", () => {
    const result = evaluateGate(
      base({
        comments: [{ body: `/visual-approve ${OLD}`, user: "owner", createdAt: "t", id: 1 }],
        fingerprintAtSha: (sha: string) => (sha === OLD ? "fp-current" : null),
      }),
    );
    expect(result.state).toBe("APPROVED");
    expect(result.summary).toMatch(/fingerprint/i);
  });

  it("reports INVALID when a later privileged reject supersedes an earlier approve", () => {
    const result = evaluateGate(
      base({
        comments: [
          { body: `/visual-approve ${HEAD}`, user: "owner", createdAt: "t1", id: 1 },
          { body: `/visual-reject ${HEAD}\nbroken on mobile`, user: "owner", createdAt: "t2", id: 2 },
        ],
      }),
    );
    expect(result.state).toBe("INVALID");
    expect(result.summary).toContain("broken on mobile");
  });

  it("reports APPROVED when a later privileged approve supersedes an earlier reject", () => {
    const result = evaluateGate(
      base({
        comments: [
          { body: `/visual-reject ${HEAD}`, user: "owner", createdAt: "t1", id: 1 },
          { body: `/visual-approve ${HEAD}`, user: "owner", createdAt: "t2", id: 2 },
        ],
      }),
    );
    expect(result.state).toBe("APPROVED");
  });

  it("ignores a malformed command embedded in a comment — ordinary conversation around it doesn't become an approval", () => {
    const result = evaluateGate(
      base({ comments: [{ body: "/visual-approve not-a-real-sha, please review soon", user: "owner", createdAt: "t", id: 1 }] }),
    );
    expect(result.state).toBe("AWAITING_APPROVAL");
  });

  it("a non-privileged actor's reject does not invalidate a privileged actor's approval", () => {
    const result = evaluateGate(
      base({
        comments: [
          { body: `/visual-approve ${HEAD}`, user: "owner", createdAt: "t1", id: 1 },
          { body: `/visual-reject ${HEAD}`, user: "random", createdAt: "t2", id: 2 },
        ],
        isActorPrivileged: (login: string) => login === "owner",
      }),
    );
    expect(result.state).toBe("APPROVED");
  });
});
