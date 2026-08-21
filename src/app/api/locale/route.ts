import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isSupportedLocale } from "@/i18n/locale";

export const runtime = "nodejs";

/**
 * Sets the NEXT_LOCALE cookie and redirects back. No auth required -- this only
 * sets a locale preference, never reads or writes app data (see AGENTS.md's auth
 * rules: this is not a protected-data route, like /api/health).
 *
 * QA/Test use: visit `/api/locale?locale=en-XA&redirect=/o/{orgSlug}/assistant` to
 * activate the pseudo-locale. No settings-page toggle exists yet (out of scope for
 * this packet — see .matchboard-work/ux-branding-language-ui/CURRENT-WORK.md).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedLocale = searchParams.get("locale");
  const requestedRedirect = searchParams.get("redirect") ?? "/";

  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;

  // Only allow a same-origin relative path -- a leading "//" is protocol-relative and
  // would redirect off-site (open-redirect), so it is rejected in favour of "/".
  const safeRedirect =
    requestedRedirect.startsWith("/") && !requestedRedirect.startsWith("//") ? requestedRedirect : "/";

  const response = NextResponse.redirect(new URL(safeRedirect, request.url));
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
