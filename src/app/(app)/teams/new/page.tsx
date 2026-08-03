import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function NewTeamRedirect() {
  return redirectToOrgSlug("/teams/new");
}