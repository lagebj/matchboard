import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function OpportunityQualityRedirect() {
  return redirectToOrgSlug("/insights/opportunity-quality");
}
