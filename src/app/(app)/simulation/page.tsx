import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function SimulationRedirect() {
  return redirectToOrgSlug("/simulation");
}