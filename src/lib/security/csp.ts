import { isDevelopment, isCspEnforceEnabled } from "@/lib/env";

export function isCspReportOnly(): boolean {
  return !isCspEnforceEnabled();
}

export function getContentSecurityPolicy(pathname?: string): { header: string; value: string } {
  const isDev = isDevelopment();
  const reportOnly = isCspReportOnly();

  // The public docs route is embedded same-origin inside the authenticated Help drawer
  // (help-drawer.tsx, ADR-0103) via an <iframe>. `frame-ancestors 'none'` (below) is the
  // right default everywhere else -- it is Matchboard's clickjacking protection for every
  // authenticated application route, which must never be embeddable. /docs/** is the one
  // narrow, deliberate exception: it carries no tenant/session data of its own (PUBLIC_ROUTES,
  // src/lib/env.ts), so allowing it to be framed by this same origin only ('self', not '*')
  // does not weaken protection for any other route.
  const isDocsRoute = pathname === "/docs" || pathname?.startsWith("/docs/");

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
    //
    // ADR-0148 AI Advisor: the browser submits the provider credential directly to the
    // matchboard-security enrollment service (ai-advisor-section.tsx's browser-direct enrollment
    // fetch) so the credential itself never transits our own servers. CSP was never updated when
    // that shipped, so the browser silently blocked the request with "violates ... connect-src"
    // even though the server-side wiring (bootstrap route, signed token) was correct — the same
    // class of regression as the realtime origins above. `AI_SECURITY_ENROLLMENT_URL` is a public,
    // non-secret base URL (see .env.example), so reading it here to build the directive is safe;
    // when unset (AI Advisor not configured on this deployment) it is simply omitted.
    `connect-src 'self' https://vercel.live wss://vercel.live wss://realtime.matchboard.football wss://realtime-test.matchboard.football${
      process.env.AI_SECURITY_ENROLLMENT_URL ? ` ${process.env.AI_SECURITY_ENROLLMENT_URL}` : ""
    }`,
    "frame-src 'self' https://vercel.live",
    isDocsRoute ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
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