import { requirePageActorContext } from "@/lib/auth/actor-context";
import { SimulationPageContent } from "@/app/(app)/o/[orgSlug]/simulation-client-content";

export default async function SimulationPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requirePageActorContext(orgSlug);

  return <SimulationPageContent />;
}