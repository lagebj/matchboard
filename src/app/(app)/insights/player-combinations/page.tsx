import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function PlayerCombinationsRedirect() {
  return redirectToOrgSlug("/insights/player-combinations");
}
