import { ActivationHarness } from "../shared/activation-harness";
import { identity, matchInsights } from "./fixtures";

/** A08-off — the Assistant Coach slot is `null`: no reserved gap, structurally absent. */
export default function A08OffPage() {
  return <ActivationHarness title="A08 — OFF" fixedDateTimeUtc={identity.fixedDateTimeUtc} matchInsights={matchInsights} assistantCoachSlot={null} />;
}
