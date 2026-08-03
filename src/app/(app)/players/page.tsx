import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function PlayersRedirect() {
  return redirectToOrgSlug("/players");
}