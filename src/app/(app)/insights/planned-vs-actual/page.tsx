import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function PlannedVsActualRedirect() {
  return redirectToOrgSlug("/insights/planned-vs-actual");
}