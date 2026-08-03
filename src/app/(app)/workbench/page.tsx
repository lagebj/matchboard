import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function WorkbenchRedirect() {
  return redirectToOrgSlug("/workbench");
}