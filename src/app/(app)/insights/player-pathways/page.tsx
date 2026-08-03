import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function PlayerPathwaysRedirect() {
  return redirectToOrgSlug("/insights/player-pathways");
}