import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function OpportunityMatrixRedirect() {
  return redirectToOrgSlug("/insights/opportunity");
}