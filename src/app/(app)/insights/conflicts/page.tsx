import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function ConflictReviewRedirect() {
  return redirectToOrgSlug("/insights/conflicts");
}