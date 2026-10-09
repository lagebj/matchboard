"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useSourceInspector } from "../shared/use-source-inspector";
import { computeCaseBEvidence, buildDeclarationSourceRecord, buildCaseBSourceRecords } from "./view-model";
import { declaredPrimary, caseBMatchLabel } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/declared-only-versus-evidenced` — A04-S6. A declared
 * profile position is a coach statement, not actual playing experience. Case A: declared CM, no
 * actual intervals — shown honestly as a declaration only. Case B: the same declaration alongside
 * real recorded evidence (one match, 30 minutes) — shown as two separate facts, never merged or
 * auto-promoted (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` A04-S6).
 */
export default function DeclaredOnlyVersusEvidencedPage() {
  const caseAInspector = useSourceInspector();
  const caseBInspector = useSourceInspector();
  const caseBEvidence = computeCaseBEvidence();
  const declarationOnlySources = [buildDeclarationSourceRecord()];
  const caseBSources = buildCaseBSourceRecords();

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S6 — Declared position vs actual evidence</h1>
      </div>

      <AppearanceControl />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Case A — Declared only
        </p>
        <EvidenceQuestionPanel
          question="Is this player's declared profile position backed by any actual recorded playing time?"
          label="Declared profile"
          title={`Declared primary: ${declaredPrimary}`}
          valueCaption="A coach declaration — no actual match interval exists for this player yet. This is not evidence of ability or experience."
          sample="Coach-authored declaration"
          coverage="NOT_APPLICABLE"
          onInspect={caseAInspector.open}
          inspectLabel="Inspect declaration source"
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Case B — Declared and evidenced
        </p>
        <EvidenceQuestionPanel
          question="For a player with the same declaration, what does the actual recorded match evidence show?"
          label="Declared profile + recorded evidence"
          title={`Declared primary: ${declaredPrimary} — separately, ${caseBEvidence.totalMinutes} recorded minutes across ${caseBEvidence.appearanceCount} distinct match`}
          valueCaption={`${caseBMatchLabel}: the declaration and the recorded evidence are shown as two separate facts — the evidence does not automatically become, replace, or confirm the declaration.`}
          sample={caseBMatchLabel}
          coverage="COMPLETE"
          onInspect={caseBInspector.open}
          inspectLabel="Inspect declaration and evidence sources"
        />
      </div>

      <p className="text-[11px] text-[var(--text-muted)]" data-testid="s6-no-promotion-note">
        No evidence-derived profile position is ever automatically promoted to declared primary,
        secondary, or tertiary here — a real promotion requires the production confidence
        threshold and explicit coach approval (ADR-0139), not simulated by this candidate.
      </p>

      <SourceInspector
        isOpen={caseAInspector.isOpen}
        onClose={caseAInspector.close}
        title="A04-S6 Case A sources"
        description="Declaration only — no actual match evidence exists to inspect."
        sources={declarationOnlySources}
      />
      <SourceInspector
        isOpen={caseBInspector.isOpen}
        onClose={caseBInspector.close}
        title="A04-S6 Case B sources"
        description="Declaration and the real recorded match intervals behind it, shown separately."
        sources={caseBSources}
      />
    </div>
  );
}
