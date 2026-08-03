import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function NewPlayerRedirect() {
  return redirectToOrgSlug("/players/new");
}