import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function OpportunityGapRedirect() {
  return redirectToOrgSlug("/insights/opportunity-gap");
}
