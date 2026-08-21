import { isDevelopment, isCspEnforceEnabled } from "@/lib/env";

export function isCspReportOnly(): boolean {
  return !isCspEnforceEnabled();
}

export function getContentSecurityPolicy(): { header: string; value: string } {
  const isDev = isDevelopment();
  const reportOnly = isCspReportOnly();

  const directives = [
    "default-src 'self'",
    // Vercel's own Preview Comments/Toolbar loads a script (feedback.js) and opens a live
    // connection from vercel.live on every Preview deployment (confirmed live: enforcing CSP
    // without this broke every per-PR Test-slot deploy's Playwright run, 2026-08-21). frame-src
    // alone (added for the iframe itself) was not sufficient.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live${isDev ? " https://vaadin.github.io" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://accounts.google.com",
    "font-src 'self'",
    "connect-src 'self' https://vercel.live wss://vercel.live",
    "frame-src https://vercel.live",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];

  if (reportOnly) {
    directives.push("report-uri /api/csp-report");
  }

  const value = directives.join("; ");

  return {
    header: reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    value,
  };
}