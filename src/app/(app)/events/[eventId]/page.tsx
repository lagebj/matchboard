import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function EventDetailRedirect({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return redirectToOrgSlug(`/events/${eventId}`);
}