import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function LoadTimelineRedirect() {
  return redirectToOrgSlug("/insights/load");
}