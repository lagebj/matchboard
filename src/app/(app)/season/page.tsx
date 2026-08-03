import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function SeasonRedirect() {
  return redirectToOrgSlug("/season");
}