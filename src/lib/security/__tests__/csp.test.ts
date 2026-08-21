import { describe, it, expect, afterEach } from "vitest";
import { getContentSecurityPolicy, isCspReportOnly } from "../csp";

describe("CSP configuration", () => {
  const originalEnv = process.env.CSP_ENFORCE;

  afterEach(() => {
    process.env.CSP_ENFORCE = originalEnv;
  });

  it("returns Content-Security-Policy-Report-Only header when CSP_ENFORCE is not set", () => {
    delete process.env.CSP_ENFORCE;
    const csp = getContentSecurityPolicy();
    expect(csp.header).toBe("Content-Security-Policy-Report-Only");
  });

  it("returns Content-Security-Policy header when CSP_ENFORCE is true", () => {
    process.env.CSP_ENFORCE = "true";
    const csp = getContentSecurityPolicy();
    expect(csp.header).toBe("Content-Security-Policy");
  });

  it("includes required CSP directives", () => {
    const csp = getContentSecurityPolicy();
    expect(csp.value).toContain("default-src 'self'");
    expect(csp.value).toContain("frame-ancestors 'none'");
    expect(csp.value).toContain("object-src 'none'");
    expect(csp.value).toContain("base-uri 'self'");
    expect(csp.value).toContain("form-action 'self'");
  });

  it("explicitly allows Vercel's own toolbar (script, connect, and frame) via vercel.live", () => {
    // Without all three, enforcing CSP blocks Vercel's own Preview Comments/Toolbar, not app
    // behavior. frame-src alone (added for Phase 12 §77) was not sufficient — confirmed live: the
    // toolbar's own script (feedback.js) and its live connection back to vercel.live broke every
    // per-PR Test-slot Playwright run once CSP_ENFORCE=true actually went live (2026-08-21).
    const csp = getContentSecurityPolicy();
    expect(csp.value).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live");
    expect(csp.value).toContain("connect-src 'self' https://vercel.live wss://vercel.live");
    expect(csp.value).toContain("frame-src https://vercel.live");
  });

  it("includes report-uri in report-only mode", () => {
    delete process.env.CSP_ENFORCE;
    const csp = getContentSecurityPolicy();
    expect(csp.value).toContain("report-uri /api/csp-report");
  });

  it("does not include report-uri in enforce mode", () => {
    process.env.CSP_ENFORCE = "true";
    const csp = getContentSecurityPolicy();
    expect(csp.value).not.toContain("report-uri");
  });

  it("isCspReportOnly returns true by default", () => {
    delete process.env.CSP_ENFORCE;
    expect(isCspReportOnly()).toBe(true);
  });

  it("isCspReportOnly returns false when CSP_ENFORCE is true", () => {
    process.env.CSP_ENFORCE = "true";
    expect(isCspReportOnly()).toBe(false);
  });
});