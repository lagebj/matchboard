import {
  pageSearchParamsToUrlSearchParams,
  redirectToOrgSlugWithSearchParams,
  type PageSearchParams,
} from "@/lib/auth/redirect-to-org";

export default async function OperationalHealthRedirect({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;
  return redirectToOrgSlugWithSearchParams("/insights/operational-health", pageSearchParamsToUrlSearchParams(sp));
}
