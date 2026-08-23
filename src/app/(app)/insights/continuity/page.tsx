import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function ContinuityReviewRedirect() {
  return redirectToOrgSlug("/insights/continuity");
}
