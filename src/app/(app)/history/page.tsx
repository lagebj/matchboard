import {
  pageSearchParamsToUrlSearchParams,
  redirectToOrgSlugWithSearchParams,
  type PageSearchParams,
} from "@/lib/auth/redirect-to-org";

export default async function HistoryRedirect({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;
  return redirectToOrgSlugWithSearchParams("/history", pageSearchParamsToUrlSearchParams(sp));
}
