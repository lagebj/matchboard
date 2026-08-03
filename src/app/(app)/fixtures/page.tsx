import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function FixturesRedirect() {
  return redirectToOrgSlug("/fixtures");
}