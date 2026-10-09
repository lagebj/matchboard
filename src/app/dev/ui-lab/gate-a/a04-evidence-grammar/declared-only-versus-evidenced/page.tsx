"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useSourceInspector } from "../shared/use-source-inspector";
import {
  computeCaseBEvidence,
  buildCaseADeclarationSourceRecords,
  buildCaseAExposureSourceRecords,
  buildCaseBDeclarationSourceRecords,
  buildCaseBEvidenceSourceRecords,
} from "./view-model";
import { declaredPrimary, caseBMatchLabel } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/declared-only-versus-evidenced` — A04-S6. A declared
 * profile position is a coach statement, not actual playing experience. Case A: declared CM, no
 * actual intervals — the declaration itself is fully recorded (`COMPLETE`), the actual exposure is
 * a separate, `NOT_RECORDED` claim. Case B: the same declaration alongside real recorded evidence
 * (one match, 30 minutes) — shown as two separate facts, never merged or auto-promoted
 * (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` A04-S6).
 *
 * Independent review round 1 (PR #778, finding R2): the declaration and the actual-exposure/
 * evidence claims are four distinct facts, not two combined panels — each gets its own coverage
 * badge and its own scoped source inspector (finding R3).
 */
export default function DeclaredOnlyVersusEvidencedPage() {
  const caseADeclarationInspector = useSourceInspector();
  const caseAExposureInspector = useSourceInspector();
  const caseBDeclarationInspector = useSourceInspector();
  const caseBEvidenceInspector = useSourceInspector();
  const caseBEvidence = computeCaseBEvidence();

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S6 — Declared position vs actual evidence</h1>
      </div>

      <AppearanceControl />

      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Case A — Declared only
        </p>
        <EvidenceQuestionPanel
          question="Is this player's declared profile position recorded?"
          label="Declared profile"
          title={`Declared primary: ${declaredPrimary}`}
          valueCaption="A fully recorded coach declaration."
          sample="Coach-authored declaration"
          coverage="COMPLETE"
          onInspect={caseADeclarationInspector.open}
          inspectLabel="Inspect case A declaration source"
        />
        <EvidenceQuestionPanel
          question="Does this player have any actual recorded playing time backing that declaration?"
          label="Actual match exposure"
          title="Actual match exposure: Not recorded"
          valueCaption="No actual match interval exists for this player yet — checked, not merely inferred from a missing field. This is not evidence of ability or experience."
          sample="Full match history"
          coverage="NOT_RECORDED"
          onInspect={caseAExposureInspector.open}
          inspectLabel="Inspect case A exposure-check source"
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Case B — Declared and evidenced
        </p>
        <EvidenceQuestionPanel
          question="Is this player's declared profile position recorded?"
          label="Declared profile"
          title={`Declared primary: ${declaredPrimary}`}
          valueCaption="A fully recorded coach declaration — the same declared value as Case A, a different player."
          sample="Coach-authored declaration"
          coverage="COMPLETE"
          onInspect={caseBDeclarationInspector.open}
          inspectLabel="Inspect case B declaration source"
        />
        <EvidenceQuestionPanel
          question="What does the actual recorded match evidence show for this player?"
          label="Recorded match evidence"
          title={`${caseBEvidence.profile}: ${caseBEvidence.totalMinutes} recorded minutes, ${caseBEvidence.appearanceCount} distinct match`}
          valueCaption={`${caseBMatchLabel}: this evidence does not automatically become, replace, or confirm the declaration above.`}
          sample={caseBMatchLabel}
          coverage="COMPLETE"
          onInspect={caseBEvidenceInspector.open}
          inspectLabel="Inspect case B evidence sources"
        />
      </div>

      <p className="text-[11px] text-[var(--text-muted)]" data-testid="s6-no-promotion-note">
        No evidence-derived profile position is ever automatically promoted to declared primary,
        secondary, or tertiary here — a real promotion requires the production confidence
        threshold and explicit coach approval (ADR-0139), not simulated by this candidate.
      </p>

      <SourceInspector
        isOpen={caseADeclarationInspector.isOpen}
        onClose={caseADeclarationInspector.close}
        title="A04-S6 Case A declaration source"
        description="The coach declaration only."
        sources={buildCaseADeclarationSourceRecords()}
      />
      <SourceInspector
        isOpen={caseAExposureInspector.isOpen}
        onClose={caseAExposureInspector.close}
        title="A04-S6 Case A exposure-check source"
        description="Proves the actual-exposure absence was checked, not inferred."
        sources={buildCaseAExposureSourceRecords()}
      />
      <SourceInspector
        isOpen={caseBDeclarationInspector.isOpen}
        onClose={caseBDeclarationInspector.close}
        title="A04-S6 Case B declaration source"
        description="The coach declaration only — scoped separately from the recorded evidence below."
        sources={buildCaseBDeclarationSourceRecords()}
      />
      <SourceInspector
        isOpen={caseBEvidenceInspector.isOpen}
        onClose={caseBEvidenceInspector.close}
        title="A04-S6 Case B evidence sources"
        description="The real recorded match intervals — scoped separately from the declaration above."
        sources={buildCaseBEvidenceSourceRecords()}
      />
    </div>
  );
}
