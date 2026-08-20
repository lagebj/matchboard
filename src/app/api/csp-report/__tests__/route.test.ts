import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

describe("/api/csp-report", () => {
  it("returns a bodyless 204 for a valid report", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const request = new NextRequest("http://localhost/api/csp-report", {
      method: "POST",
      body: JSON.stringify({ "csp-report": { "blocked-uri": "https://example.com" } }),
    });

    // A 204 response constructed with a body throws at construction time (Fetch spec's null-body
    // status list) — this is exactly the crash a real report-only CSP violation triggered in
    // production-like conditions before the fix (Vercel's Preview-only injected toolbar; see
    // docs/adr/0075-per-pr-feature-acceptance-pipeline.md).
    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("returns 204 even for an unparseable body", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const request = new NextRequest("http://localhost/api/csp-report", {
      method: "POST",
      body: "not json",
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
  });
});
