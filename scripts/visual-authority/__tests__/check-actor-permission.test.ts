import { describe, it, expect, vi } from "vitest";
import { hasWriteAccess } from "../check-actor-permission.mjs";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("hasWriteAccess", () => {
  it("returns true for write permission", async () => {
    const result = await hasWriteAccess({
      owner: "lagebj",
      repo: "matchboard",
      actor: "someone",
      token: "x",
      fetchImpl: mockFetch(200, { permission: "write" }),
    });
    expect(result).toBe(true);
  });

  it("returns true for admin permission", async () => {
    const result = await hasWriteAccess({
      owner: "lagebj",
      repo: "matchboard",
      actor: "someone",
      token: "x",
      fetchImpl: mockFetch(200, { permission: "admin" }),
    });
    expect(result).toBe(true);
  });

  it("returns false for read permission", async () => {
    const result = await hasWriteAccess({
      owner: "lagebj",
      repo: "matchboard",
      actor: "someone",
      token: "x",
      fetchImpl: mockFetch(200, { permission: "read" }),
    });
    expect(result).toBe(false);
  });

  it("returns false when the actor isn't a collaborator at all (404)", async () => {
    const result = await hasWriteAccess({
      owner: "lagebj",
      repo: "matchboard",
      actor: "random-fork-contributor",
      token: "x",
      fetchImpl: mockFetch(404, {}),
    });
    expect(result).toBe(false);
  });

  it("returns false, never throws, on a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await hasWriteAccess({ owner: "lagebj", repo: "matchboard", actor: "x", token: "x", fetchImpl });
    expect(result).toBe(false);
  });

  it("includes the required headers", async () => {
    const fetchImpl = mockFetch(200, { permission: "write" });
    await hasWriteAccess({ owner: "lagebj", repo: "matchboard", actor: "x", token: "secret-token", fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer secret-token");
    expect(init.headers["User-Agent"]).toBeTruthy();
  });
});
