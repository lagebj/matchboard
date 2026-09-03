import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function MatchPhasePatternsRedirect() {
  return redirectToOrgSlug("/insights/match-phase-patterns");
}
