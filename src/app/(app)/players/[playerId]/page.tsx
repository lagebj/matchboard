import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function PlayerDetailRedirect({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  return redirectToOrgSlug(`/players/${playerId}`);
}