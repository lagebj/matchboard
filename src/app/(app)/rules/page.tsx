import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function RulesRedirect() {
  return redirectToOrgSlug("/rules");
}