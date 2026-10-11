"use client";

import { useState } from "react";
import { ActivationHarness } from "../shared/activation-harness";
import { AssistantCoachHypothesisCard, type AssistantCoachHypothesisOutcome } from "../../shared/assistant-coach-hypothesis-card";
import { identity, hypothesis, matchInsights } from "./fixtures";

/** A08-on-strong-pattern — conspicuous, trustworthy synthesis: the hypothesis card, not filler. */
export default function A08OnStrongPatternPage() {
  const [outcome, setOutcome] = useState<AssistantCoachHypothesisOutcome>(null);

  return (
    <ActivationHarness
      title="A08 — ON, strong pattern"
      fixedDateTimeUtc={identity.fixedDateTimeUtc}
      matchInsights={matchInsights}
      assistantCoachSlot={
        <AssistantCoachHypothesisCard hypothesis={hypothesis} outcome={outcome} onPromote={() => setOutcome("PROMOTED")} onDismiss={() => setOutcome("DISMISSED")} />
      }
    />
  );
}
