import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function NewSeasonRedirect() {
  return redirectToOrgSlug("/season/new");
}