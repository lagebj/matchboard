"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useActiveSourceClaim } from "../shared/use-active-source-claim";
import {
  computeCaseBEvidence,
  buildCaseADeclarationSourceRecords,
  buildCaseAExposureSourceRecords,
  buildCaseBDeclarationSourceRecords,
  buildCaseBEvidenceSourceRecords,
} from "./view-model";
import { declaredPrimary, caseBMatchLabel } from "./fixtures";

type ClaimKey = "caseA-declaration" | "caseA-exposure" | "caseB-declaration" | "caseB-evidence";

const CLAIM_CONFIG: Record<ClaimKey, { title: string; description: string }> = {
  "caseA-declaration": { title: "A04-S6 Case A declaration source", description: "The coach declaration only." },
  "caseA-exposure": {
    title: "A04-S6 Case A exposure-check source",
    description: "Proves the actual-exposure absence was checked, not inferred.",
  },
  "caseB-declaration": {
    title: "A04-S6 Case B declaration source",
    description: "The coach declaration only — scoped separately from the recorded evidence below.",
  },
  "caseB-evidence": {
    title: "A04-S6 Case B evidence sources",
    description: "The real recorded match intervals — scoped separately from the declaration above.",
  },
};

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/declared-only-versus-evidenced` — A04-S6. A declared
 * profile position is a coach statement, not actual playing experience. Case A: declared CM, no
 * actual intervals — the declaration itself is fully recorded (`COMPLETE`), the actual exposure is
 * a separate, `NOT_RECORDED` claim. Case B: the same declaration alongside real recorded evidence
 * (one match, 30 minutes) — shown as two separate facts, never merged or auto-promoted
 * (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` A04-S6).
 *
 * Independent review round 1 (PR #778, finding R2): the declaration and the actual-exposure/
 * evidence claims are four distinct facts, not two combined panels. Independent review round 2
 * (finding R4): exactly ONE `SourceInspector` element is ever mounted across all four claims —
 * repositioned next to whichever case group (A or B) the active claim belongs to via CSS `order`
 * on a shared flex container, never by rendering it at two different JSX call sites. A first
 * attempt rendered it at two conditional call sites (one inside each case's own `<div>`) so it
 * would sit visually next to the active group; that remounted the component whenever a claim in
 * the OTHER group was selected, and the freshly-mounted instance's `useMediaQuery` briefly
 * reported its SSR-safe default (`false`, i.e. "not desktop") before its own effect corrected it —
 * so a desktop switch across groups flashed the mobile bottom sheet for one render, which the
 * capture script's sheet-settle wait then hung on. CSS `order` repositions the SAME element
 * without unmounting it, so this never happens.
 */
export default function DeclaredOnlyVersusEvidencedPage() {
  const inspector = useActiveSourceClaim<ClaimKey>();
  const caseBEvidence = computeCaseBEvidence();

  const isCaseBActive = inspector.activeClaim === "caseB-declaration" || inspector.activeClaim === "caseB-evidence";

  const sourcesFor = (key: ClaimKey) => {
    switch (key) {
      case "caseA-declaration":
        return buildCaseADeclarationSourceRecords();
      case "caseA-exposure":
        return buildCaseAExposureSourceRecords();
      case "caseB-declaration":
        return buildCaseBDeclarationSourceRecords();
      case "caseB-evidence":
        return buildCaseBEvidenceSourceRecords();
    }
  };

  const activeConfig = inspector.activeClaim ? CLAIM_CONFIG[inspector.activeClaim] : null;
  const activeSources = inspector.activeClaim ? sourcesFor(inspector.activeClaim) : [];

  // Single shared flex container so the one SourceInspector instance can be repositioned via
  // `order` (never a second JSX call site / remount) next to whichever group is active.
  const inspectorOrderClass = isCaseBActive ? "order-4" : "order-2";

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S6 — Declared position vs actual evidence</h1>
      </div>

      <AppearanceControl />

      <div className="flex flex-col gap-6">
        <div className="order-1 flex flex-col gap-3">
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
            onInspect={() => inspector.open("caseA-declaration")}
            inspectLabel="Inspect case A declaration source"
          />
          <EvidenceQuestionPanel
            question="Does this player have any actual recorded playing time backing that declaration?"
            label="Actual match exposure"
            title="Actual match exposure: Not recorded"
            valueCaption="No actual match interval exists for this player yet — checked, not merely inferred from a missing field. This is not evidence of ability or experience."
            sample="Full match history"
            coverage="NOT_RECORDED"
            onInspect={() => inspector.open("caseA-exposure")}
            inspectLabel="Inspect case A exposure-check source"
          />
        </div>

        <div className="order-3 flex flex-col gap-3">
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
            onInspect={() => inspector.open("caseB-declaration")}
            inspectLabel="Inspect case B declaration source"
          />
          <EvidenceQuestionPanel
            question="What does the actual recorded match evidence show for this player?"
            label="Recorded match evidence"
            title={`${caseBEvidence.profile}: ${caseBEvidence.totalMinutes} recorded minutes, ${caseBEvidence.appearanceCount} distinct match`}
            valueCaption={`${caseBMatchLabel}: this evidence does not automatically become, replace, or confirm the declaration above.`}
            sample={caseBMatchLabel}
            coverage="COMPLETE"
            onInspect={() => inspector.open("caseB-evidence")}
            inspectLabel="Inspect case B evidence sources"
          />
        </div>

        {activeConfig ? (
          <SourceInspector
            isOpen={inspector.activeClaim !== null}
            onClose={inspector.close}
            title={activeConfig.title}
            description={activeConfig.description}
            sources={activeSources}
            className={inspectorOrderClass}
          />
        ) : null}

        <p className="order-5 text-[11px] text-[var(--text-muted)]" data-testid="s6-no-promotion-note">
          No evidence-derived profile position is ever automatically promoted to declared primary,
          secondary, or tertiary here — a real promotion requires the production confidence
          threshold and explicit coach approval (ADR-0139), not simulated by this candidate.
        </p>
      </div>
    </div>
  );
}
