import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function EventsRedirect() {
  return redirectToOrgSlug("/events");
}