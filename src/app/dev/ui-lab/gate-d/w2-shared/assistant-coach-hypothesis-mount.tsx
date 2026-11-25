"use client";

import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import {
  AssistantCoachHypothesisPanel,
  type AssistantCoachHypothesisActionResult,
  type AssistantCoachHypothesisActions,
  type AssistantCoachHypothesisViewModel,
} from "@/components/ai/assistant-coach-hypothesis-panel";

export const GATE_D_W2_ORG_SLUG = "gate-d-w2-fixture-org";

/**
 * Gate D Wave 2 shared mount, modeled exactly on Gate C W3's `GateCW3TodayMount`
 * (`gate-c/w3-shared/today-mount.tsx`): a `"use client"` boundary so every scenario's `page.tsx`
 * stays a plain server component. The simulated confirm/dismiss handlers are constructed here,
 * inside this already-client module — never serialized across the server/client boundary as a
 * prop. Passing a plain closure from a server `fixtures.ts`/`page.tsx` crashed C07's real capture
 * job with a React Server Components error, invisible to jsdom component tests that render the
 * page directly and never cross the real boundary; this mount exists specifically to avoid that.
 *
 * `confirmErrorByHypothesisId` lets one scenario demonstrate the real failure-response path
 * (D03 §11: "Failure response where relevant") without ever calling a real Server Action — a
 * single shared `actions` object already receives the hypothesis id on every call, exactly like
 * production's own real Server Actions, so one mount instance can host several hypotheses with
 * different simulated outcomes.
 */
function buildSimulatedActions(confirmErrorByHypothesisId: Record<string, string>): AssistantCoachHypothesisActions {
  return {
    confirm: (hypothesisId: string): Promise<AssistantCoachHypothesisActionResult> => {
      const error = confirmErrorByHypothesisId[hypothesisId];
      return Promise.resolve(error ? { success: false, error } : { success: true });
    },
    dismiss: (): Promise<AssistantCoachHypothesisActionResult> => Promise.resolve({ success: true }),
  };
}

export function AssistantCoachHypothesisMount({
  hypotheses,
  simulateActions,
  confirmErrorByHypothesisId = {},
}: {
  hypotheses: AssistantCoachHypothesisViewModel[];
  /** Every Gate D W2 interactive scenario passes `true` — a UI Lab fixture's synthetic hypothesis
   * ids have no persisted `AssistantCoachHypothesis` row and no real session, so the real Server
   * Actions would hit an uncaught auth failure, not a clean "not found" (see the panel's own doc
   * comment). Kept as an explicit flag, matching `GateCW3TodayMount`'s own shape, rather than
   * always-on, so the "no real Server Action" discipline stays visible in code review. */
  simulateActions?: boolean;
  confirmErrorByHypothesisId?: Record<string, string>;
}) {
  return (
    <OrgSlugProvider orgSlug={GATE_D_W2_ORG_SLUG}>
      <AssistantCoachHypothesisPanel
        hypotheses={hypotheses}
        actions={simulateActions ? buildSimulatedActions(confirmErrorByHypothesisId) : undefined}
      />
    </OrgSlugProvider>
  );
}
