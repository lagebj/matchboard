import {
  pageSearchParamsToUrlSearchParams,
  redirectToOrgSlugWithSearchParams,
  type PageSearchParams,
} from "@/lib/auth/redirect-to-org";

export default async function OpportunityGapRedirect({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;
  return redirectToOrgSlugWithSearchParams("/insights/opportunity-gap", pageSearchParamsToUrlSearchParams(sp));
}
