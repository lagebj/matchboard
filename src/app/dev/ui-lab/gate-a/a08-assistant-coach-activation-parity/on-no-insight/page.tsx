import { ActivationHarness } from "../shared/activation-harness";
import { AssistantCoachNoPatternNotice } from "../../shared/assistant-coach-hypothesis-card";
import { identity, matchInsights } from "./fixtures";

/** A08-on-no-insight — an honest quiet line, never a fabricated placeholder card. */
export default function A08OnNoInsightPage() {
  return (
    <ActivationHarness
      title="A08 — ON, no insight"
      fixedDateTimeUtc={identity.fixedDateTimeUtc}
      matchInsights={matchInsights}
      assistantCoachSlot={<AssistantCoachNoPatternNotice />}
    />
  );
}
