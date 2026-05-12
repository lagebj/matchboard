import { edgeAuth } from "@/auth-edge";
import { NextResponse } from "next/server";

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
    return NextResponse.next();
  }

  const email = req.auth?.user?.email;

  if (!email) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl));
  }

  const allowed = process.env.ALLOWED_COACH_EMAILS;
  if (!allowed) {
    return NextResponse.redirect(new URL("/error", req.nextUrl));
  }

  const allowedEmails = allowed
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (!allowedEmails.includes(email.trim().toLowerCase())) {
    return NextResponse.redirect(new URL("/error", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};