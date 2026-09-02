import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getContentSecurityPolicy } from "@/lib/security/csp";
import { isPublicRoute, isProduction, getPreviewAllowlistEmails, isVercelPreview } from "@/lib/env";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-DNS-Prefetch-Control": "on",
};

/** Exported for regression testing (src/test/security-audit.test.ts) without needing to invoke
 * the full auth-wrapped handler. See the call site's comment for why
 * /api/internal/** must never be subject to the preview-allowlist gate. */
export function requiresPreviewAllowlistCheck(path: string): boolean {
  return path.startsWith("/api/") && !path.startsWith("/api/internal/");
}

function withSecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // X-Frame-Options has no per-origin allowance like CSP's frame-ancestors 'self' -- only
    // DENY or SAMEORIGIN. /docs/** is same-origin-embeddable (Help drawer, ADR-0103); every
    // other route keeps DENY, its existing clickjacking protection.
    if (key === "X-Frame-Options" && pathname && (pathname === "/docs" || pathname.startsWith("/docs/"))) {
      response.headers.set(key, "SAMEORIGIN");
      continue;
    }
    response.headers.set(key, value);
  }
  if (isProduction()) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  const csp = getContentSecurityPolicy(pathname);
  response.headers.set(csp.header, csp.value);
  return response;
}

export default auth((req) => {
  const path = req.nextUrl.pathname;

  if (isPublicRoute(path)) {
    const response = NextResponse.next();
    return withSecurityHeaders(response, path);
  }

  // PREVIEW_ALLOWLIST_EMAILS restricts preview deployment API access.
  // When unset or empty, all authenticated users can access preview API routes.
  // When set, only listed email addresses can access preview API routes.
  // This is separate from application authorization (organisation membership)
  // and is intended only for preview deployment protection, not as an auth mechanism.
  //
  // /api/internal/** is deliberately excluded: it has no session/cookie identity to check in
  // the first place (HMAC signature verification — verifyInternalRequest() — is its only gate,
  // by design; see src/app/api/internal/live-match/events/route.ts's own doc comment). Every
  // call from the Cloudflare Worker to a PR's Test-slot Preview deployment was being rejected
  // here with 403 before ever reaching that HMAC check (req.auth?.user?.email is always
  // undefined for a machine-to-machine request with no cookie), and since
  // classifyPersistenceFailure() (workers/live-match/src/state.ts) had no way to distinguish
  // this from a transient failure, the Durable Object retried indefinitely with backoff for the
  // life of every live-match session run against any PR's Test slot — confirmed live via Vercel
  // runtime logs (1000+ rejected /api/internal/live-match/events calls in one ~12-minute E2E
  // run) as the actual mechanism behind the previously-observed Cloudflare DO exhaustion.
  if (isVercelPreview() && requiresPreviewAllowlistCheck(path)) {
    const previewAllowlist = getPreviewAllowlistEmails()
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const email = req.auth?.user?.email?.trim().toLowerCase();

    if (!email || (previewAllowlist.length > 0 && !previewAllowlist.includes(email))) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Preview deployment access restricted" }, { status: 403 }),
      );
    }
  }

  const email = req.auth?.user?.email;

  if (!email) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/signin", req.nextUrl)));
  }

  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};