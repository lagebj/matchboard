import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function OperationalHealthRedirect() {
  return redirectToOrgSlug("/insights/operational-health");
}
