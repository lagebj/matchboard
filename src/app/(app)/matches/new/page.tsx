import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function NewMatchRedirect() {
  return redirectToOrgSlug("/matches/new");
}