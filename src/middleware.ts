import { edgeAuth } from "@/auth-edge";
import { NextResponse } from "next/server";
import { getContentSecurityPolicy } from "@/lib/security/csp";
import { isPublicRoute } from "@/lib/env";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-DNS-Prefetch-Control": "on",
};

const PREVIEW_ALLOWLIST_ENV = process.env.PREVIEW_ALLOWLIST_EMAILS;

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  const csp = getContentSecurityPolicy();
  response.headers.set(csp.header, csp.value);
  return response;
}

function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export default edgeAuth((req) => {
  const path = req.nextUrl.pathname;

  if (isPublicRoute(path)) {
    const response = NextResponse.next();
    return withSecurityHeaders(response);
  }

  if (isPreviewDeployment() && path.startsWith("/api/")) {
    const previewAllowlist = (PREVIEW_ALLOWLIST_ENV || "")
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