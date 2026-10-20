import { describe, it, expect } from "vitest";
import { getLease, setLease, clearLease, parseLeaseBody, renderLeaseBody, EMPTY_LEASE } from "../test-slot-lease.mjs";

type FakeIssue = { title: string; body?: string };

function fakeGitHub() {
  const state = { issues: new Map<number, FakeIssue>(), nextNumber: 1 };
  const fetchImpl = async (path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) => {
    const method = init.method ?? "GET";
    if (path.startsWith("/search/issues")) {
      const items = [...state.issues.entries()].map(([number, issue]) => ({ number, title: issue.title }));
      return { ok: true, json: async () => ({ items }) };
    }
    const m = path.match(/^\/repos\/o\/r\/issues\/(\d+)$/);
    if (m) {
      const number = Number(m[1]);
      if (method === "GET") {
        const issue = state.issues.get(number);
        return issue ? { ok: true, json: async () => issue } : { ok: false, status: 404, text: async () => "not found" };
      }
      if (method === "PATCH") {
        const body = JSON.parse(init.body!) as Partial<FakeIssue>;
        const existing = state.issues.get(number) ?? { title: "x" };
        state.issues.set(number, { ...existing, ...body });
        return { ok: true, json: async () => state.issues.get(number) };
      }
    }
    if (path === "/repos/o/r/issues" && method === "POST") {
      const body = JSON.parse(init.body!) as FakeIssue;
      const number = state.nextNumber++;
      state.issues.set(number, body);
      return { ok: true, json: async () => ({ number, ...body }) };
    }
    return { ok: false, status: 404, text: async () => "unhandled" };
  };
  return { fetchImpl, state };
}

describe("parseLeaseBody / renderLeaseBody", () => {
  it("round-trips a lease through render then parse", () => {
    const lease = { prNumber: "790", sha: "abc123", actor: "lagebj", acquiredAt: "2026-01-01T00:00:00Z", status: "active", deploymentUrl: null };
    expect(parseLeaseBody(renderLeaseBody(lease))).toEqual(lease);
  });

  it("returns the empty lease for a body with no JSON block", () => {
    expect(parseLeaseBody("just some text")).toEqual(EMPTY_LEASE);
  });

  it("returns the empty lease for malformed JSON rather than throwing", () => {
    expect(parseLeaseBody("```json\n{not valid json\n```")).toEqual(EMPTY_LEASE);
  });

  it("returns the empty lease for undefined/null body", () => {
    expect(parseLeaseBody(undefined)).toEqual(EMPTY_LEASE);
    expect(parseLeaseBody(null)).toEqual(EMPTY_LEASE);
  });
});

describe("getLease / setLease / clearLease (mocked GitHub)", () => {
  it("returns the empty lease when no lease issue exists yet", async () => {
    const { fetchImpl } = fakeGitHub();
    expect(await getLease({ owner: "o", repo: "r", fetchImpl })).toEqual(EMPTY_LEASE);
  });

  it("creates the lease issue on first set, then reads it back correctly", async () => {
    const { fetchImpl } = fakeGitHub();
    const lease = { prNumber: "790", sha: "abc123", actor: "lagebj", acquiredAt: "2026-01-01T00:00:00Z", status: "active", deploymentUrl: null };
    await setLease({ owner: "o", repo: "r", fetchImpl }, lease);
    expect(await getLease({ owner: "o", repo: "r", fetchImpl })).toEqual(lease);
  });

  it("updates the existing lease issue on a second set, rather than creating a duplicate", async () => {
    const { fetchImpl, state } = fakeGitHub();
    await setLease({ owner: "o", repo: "r", fetchImpl }, { ...EMPTY_LEASE, prNumber: "1", status: "active" });
    await setLease({ owner: "o", repo: "r", fetchImpl }, { ...EMPTY_LEASE, prNumber: "2", status: "active" });
    expect(state.issues.size).toBe(1);
    const lease = await getLease({ owner: "o", repo: "r", fetchImpl });
    expect(lease.prNumber).toBe("2");
  });

  it("clearLease resets to the empty/released lease", async () => {
    const { fetchImpl } = fakeGitHub();
    await setLease({ owner: "o", repo: "r", fetchImpl }, { ...EMPTY_LEASE, prNumber: "790", status: "active" });
    await clearLease({ owner: "o", repo: "r", fetchImpl });
    expect(await getLease({ owner: "o", repo: "r", fetchImpl })).toEqual(EMPTY_LEASE);
  });
});
