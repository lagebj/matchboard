import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function MatchDetailRedirect({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return redirectToOrgSlug(`/matches/${matchId}`);
}