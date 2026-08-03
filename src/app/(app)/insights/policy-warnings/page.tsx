import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function PolicyWarningsRedirect() {
  return redirectToOrgSlug("/insights/policy-warnings");
}