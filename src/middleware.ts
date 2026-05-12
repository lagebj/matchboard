import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const publicRoutes = ["/signin", "/error"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (!token || !token.email) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const allowed = process.env.ALLOWED_COACH_EMAILS;
  if (!allowed) {
    return NextResponse.redirect(new URL("/error", req.url));
  }

  const allowedEmails = allowed
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (!allowedEmails.includes((token.email as string).trim().toLowerCase())) {
    return NextResponse.redirect(new URL("/error", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};