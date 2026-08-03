import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function TeamDetailRedirect({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return redirectToOrgSlug(`/teams/${teamId}`);
}