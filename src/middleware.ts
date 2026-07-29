import { edgeAuth } from "@/auth-edge";
import { NextResponse } from "next/server";
import { getContentSecurityPolicy } from "@/lib/security/csp";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-DNS-Prefetch-Control": "on",
};

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  const csp = getContentSecurityPolicy();
  response.headers.set(csp.header, csp.value);
  return response;
}

export default edgeAuth((req) => {
  const path = req.nextUrl.pathname;

  const isPublic =
    path.startsWith("/api/auth") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/signin" ||
    path === "/error";

  if (isPublic) {
    const response = NextResponse.next();
    return withSecurityHeaders(response);
  }

  const email = req.auth?.user?.email;

  if (!email) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/signin", req.nextUrl)));
  }

  const allowed = process.env.ALLOWED_COACH_EMAILS;
  if (!allowed) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/error", req.nextUrl)));
  }

  const allowedEmails = allowed
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (!allowedEmails.includes(email.trim().toLowerCase())) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/error", req.nextUrl)));
  }

  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};