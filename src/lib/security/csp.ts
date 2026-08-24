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
    // ADR-0086 live-match-realtime-programme: the browser client connects directly to the
    // Cloudflare Worker's WebSocket endpoint (RealtimeMatchClient, follow-live-client.tsx) — CSP
    // was never updated when that shipped, so the browser silently blocked every connection
    // attempt regardless of server-side correctness. Discovered live via a Playwright console
    // listener during E2E testing (2026-08-24): "violates ... connect-src" on
    // wss://realtime-test.matchboard.football, explaining both "Follow live" showing
    // "Connection problem" and reporting-coach events getting stuck in "Sync issue" whenever the
    // realtime-first path (Stage 5) was attempted. Both hostnames are allowed unconditionally
    // (harmless in either environment) rather than branching on isDev/isCspEnforceEnabled.
    "connect-src 'self' https://vercel.live wss://vercel.live wss://realtime.matchboard.football wss://realtime-test.matchboard.football",
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