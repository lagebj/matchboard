export const dynamic = "force-dynamic";

import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { getAssistantCommandCentre } from "@/lib/assistant/get-assistant-command-centre";
import { AssistantCommandCentrePage } from "@/components/assistant/assistant-command-centre-page";

export default async function AssistantPage() {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");
  const commandCentre = await getAssistantCommandCentre(orgFilter);

  return <AssistantCommandCentrePage commandCentre={commandCentre} />;
}