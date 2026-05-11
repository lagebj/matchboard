import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/auth/signin", "/auth/error"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  const email = req.auth.user?.email;
  if (!email) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  const allowed = process.env.ALLOWED_COACH_EMAILS;
  if (!allowed) {
    return NextResponse.redirect(new URL("/auth/error", req.url));
  }

  const allowedEmails = allowed
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (!allowedEmails.includes(email.trim().toLowerCase())) {
    return NextResponse.redirect(new URL("/auth/error", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};