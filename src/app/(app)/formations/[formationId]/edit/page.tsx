import { redirectToOrgSlug } from "@/lib/auth/redirect-to-org";

export default async function FormationEditRedirect({ params }: { params: Promise<{ formationId: string }> }) {
  const { formationId } = await params;
  return redirectToOrgSlug(`/formations/${formationId}/edit`);
}