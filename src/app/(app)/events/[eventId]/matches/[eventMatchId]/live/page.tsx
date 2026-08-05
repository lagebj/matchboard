import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function EventMatchLiveRedirect({ params }: { params: Promise<{ eventId: string; eventMatchId: string }> }) {
  const { eventId, eventMatchId } = await params;
  return redirectToOrgSlug(`/events/${eventId}/matches/${eventMatchId}/live`);
}