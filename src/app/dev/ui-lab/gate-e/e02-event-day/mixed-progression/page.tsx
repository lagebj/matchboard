import { E02CandidatePage } from "../shared/e02-candidate-page";
import { fixture } from "./fixtures";

/** Gate E W2 — E02 child candidate `GATE-E-W2-E02-MIXED`. See `docs/ui-lab/gate-e-w2-candidates/SCENARIO_REGISTER.md`. */
export default function E02MixedProgressionPage() {
  return <E02CandidatePage label="Mixed progression state" fixture={fixture} />;
}
