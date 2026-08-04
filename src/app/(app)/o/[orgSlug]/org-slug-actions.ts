"use server";

import { cookies } from "next/headers";

const ORG_SLUG_COOKIE = "x-matchboard-org-slug";

export async function setOrgSlugCookieAction(orgSlug: string) {
  const cookieStore = await cookies();
  cookieStore.set(ORG_SLUG_COOKIE, orgSlug, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
}
