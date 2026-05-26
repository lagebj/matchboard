export const dynamic = "force-dynamic";

import { getAssistantCommandCentre } from "@/lib/assistant/get-assistant-command-centre";
import { AssistantCommandCentrePage } from "@/components/assistant/assistant-command-centre-page";

export default async function AssistantPage() {
  const commandCentre = await getAssistantCommandCentre();

  return <AssistantCommandCentrePage commandCentre={commandCentre} />;
}