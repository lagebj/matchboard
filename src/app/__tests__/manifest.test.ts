import { describe, it, expect, vi } from "vitest";
import manifest from "../manifest";
import { headers } from "next/headers";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const mockedHeaders = vi.mocked(headers);

function withHost(host: string | null) {
  mockedHeaders.mockResolvedValue({
    get: (key: string) => (key === "host" ? host : null),
  } as unknown as Awaited<ReturnType<typeof headers>>);
}

describe("manifest (PWA, UX-2.10-01)", () => {
  it("returns Production naming for the default hostname", async () => {
    withHost("app.matchboard.football");
    const result = await manifest();
    expect(result.name).toBe("Matchboard");
    expect(result.short_name).toBe("Matchboard");
  });

  it("returns Test naming for the test hostname", async () => {
    withHost("test.matchboard.football");
    const result = await manifest();
    expect(result.name).toBe("Matchboard Test");
    expect(result.short_name).toBe("Matchboard Test");
  });

  it("does not mistake a hostname merely containing 'test' elsewhere for the Test environment", async () => {
    withHost("attest.matchboard.football");
    const result = await manifest();
    expect(result.name).toBe("Matchboard");
  });

  it("points start_url at the canonical /today route", async () => {
    withHost("app.matchboard.football");
    const result = await manifest();
    expect(result.start_url).toBe("/today");
    expect(result.scope).toBe("/");
  });

  it("has at most 3 shortcuts, pointing at canonical routes", async () => {
    withHost("app.matchboard.football");
    const result = await manifest();
    expect(result.shortcuts?.length).toBeLessThanOrEqual(3);
    expect(result.shortcuts?.map((s) => s.url)).toEqual(["/today", "/fixtures", "/events"]);
  });

  it("handles a missing host header without throwing", async () => {
    withHost(null);
    const result = await manifest();
    expect(result.name).toBe("Matchboard");
  });

  it("includes both required icon sizes", async () => {
    withHost("app.matchboard.football");
    const result = await manifest();
    const sizes = result.icons?.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("declares maskable purpose for both sizes, reusing the existing icon files", async () => {
    withHost("app.matchboard.football");
    const result = await manifest();
    const maskable = result.icons?.filter((i) => i.purpose === "maskable") ?? [];
    expect(maskable.map((i) => i.sizes).sort()).toEqual(["192x192", "512x512"]);
    for (const icon of maskable) {
      expect(icon.src).toMatch(/^\/brand\/android-chrome-\d+x\d+\.png$/);
    }
  });
});
