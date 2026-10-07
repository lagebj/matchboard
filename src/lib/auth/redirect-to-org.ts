import { redirect } from "next/navigation";
import { resolveOrgSlugForLayout } from "@/lib/auth/resolve-org-slug";

/** Next.js page `searchParams` shape (values may be repeated arrays, single values, or absent). */
export type PageSearchParams = Record<string, string | string[] | undefined>;

/** Convert a Next.js page `searchParams` object to a `URLSearchParams`, preserving repeated keys. */
export function pageSearchParamsToUrlSearchParams(sp: PageSearchParams): URLSearchParams {
  return new URLSearchParams(
    Object.entries(sp).flatMap(([key, value]): [string, string][] =>
      Array.isArray(value)
        ? value.map((v) => [key, v])
        : value !== undefined
          ? [[key, value]]
          : [],
    ),
  );
}

export async function redirectToOrgSlug(path: string): Promise<never> {
  const orgSlug = await resolveOrgSlugForLayout();
  redirect(`/o/${orgSlug}${path}`);
}

/**
 * Same as `redirectToOrgSlug`, but forwards the request's query string. Used by root shims for
 * retired routes (e.g. `/insights/opportunity-gap?leagueSeasonId=X`) whose org-scoped target
 * page needs the original deep-link's selected-entity params (ADR-0157 C8 deep-link
 * compatibility).
 */
export async function redirectToOrgSlugWithSearchParams(
  path: string,
  searchParams: URLSearchParams,
): Promise<never> {
  const queryString = searchParams.toString();
  return redirectToOrgSlug(queryString ? `${path}?${queryString}` : path);
}