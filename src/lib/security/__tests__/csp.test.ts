import { describe, it, expect, vi, afterEach } from "vitest";
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