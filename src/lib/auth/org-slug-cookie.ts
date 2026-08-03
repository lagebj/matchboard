import { cookies } from "next/headers";

const ORG_SLUG_COOKIE = "x-matchboard-org-slug";

export async function getOrgSlugFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ORG_SLUG_COOKIE)?.value;
}