import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function OpponentsRedirect() {
  return redirectToOrgSlug("/opponents");
}