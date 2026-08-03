import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function RoundsRedirect() {
  return redirectToOrgSlug("/rounds");
}