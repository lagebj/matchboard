import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function NewEventRedirect() {
  return redirectToOrgSlug("/events/new");
}