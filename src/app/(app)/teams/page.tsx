import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function TeamsRedirect() {
  return redirectToOrgSlug("/teams");
}