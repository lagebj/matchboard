import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function OpponentDetailRedirect({ params }: { params: Promise<{ opponentTeamId: string }> }) {
  const { opponentTeamId } = await params;
  return redirectToOrgSlug(`/opponents/${opponentTeamId}`);
}