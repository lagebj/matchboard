import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function HistoryRedirect() {
  return redirectToOrgSlug("/history");
}