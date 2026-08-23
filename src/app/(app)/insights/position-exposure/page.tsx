import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function PositionExposureRedirect() {
  return redirectToOrgSlug("/insights/position-exposure");
}
