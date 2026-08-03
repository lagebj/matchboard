import { requireActorContext } from "@/lib/auth/actor-context";
import { WorkbenchPageContent } from "@/app/(app)/o/[orgSlug]/workbench-client-content";

export default async function WorkbenchPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await requireActorContext(orgSlug);

  return <WorkbenchPageContent />;
}