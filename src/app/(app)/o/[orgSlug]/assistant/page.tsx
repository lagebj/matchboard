export const dynamic = "force-dynamic";

import { requireActorContext } from "@/lib/auth/actor-context";
import { getAssistantCommandCentre } from "@/lib/assistant/get-assistant-command-centre";
import { AssistantCommandCentrePage } from "@/components/assistant/assistant-command-centre-page";

export default async function AssistantPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireActorContext(orgSlug);
  const commandCentre = await getAssistantCommandCentre(ctx.orgFilter);

  return <AssistantCommandCentrePage commandCentre={commandCentre} />;
}