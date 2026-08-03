import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function TeamConfigurationRedirect({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return redirectToOrgSlug(`/teams/${teamId}/configuration`);
}