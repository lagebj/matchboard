import {
  pageSearchParamsToUrlSearchParams,
  redirectToOrgSlugWithSearchParams,
  type PageSearchParams,
} from "@/lib/auth/redirect-to-org";

export default async function ContinuityRedirect({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;
  return redirectToOrgSlugWithSearchParams("/insights/continuity", pageSearchParamsToUrlSearchParams(sp));
}
