import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function NewFormationRedirect() {
  return redirectToOrgSlug("/formations/new");
}