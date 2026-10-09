"use client";

import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { EvidenceQuestionPanel } from "../shared/evidence-question-panel";
import { SourceInspector } from "../shared/source-inspector";
import { useSourceInspector } from "../shared/use-source-inspector";
import { finalScoreLabel, buildResultSourceRecords, buildEventSourceRecords } from "./view-model";
import { homeTeam, awayTeam, eventLog } from "./fixtures";

/**
 * `/dev/ui-lab/gate-a/a04-evidence-grammar/sparse-score-events` — A04-S4. The final score and the
 * event-by-event timeline are two separate source classes with two separate coverage states — the
 * recorded result can be `COMPLETE` while the event chronology stays `PARTIAL`, and the UI must
 * never pretend one implies the other (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` A04-S4).
 *
 * Independent review round 1 (PR #778, finding R3): each claim gets its own scoped inspector —
 * the event inspector must show only the event record, never the result record first.
 */
export default function SparseScoreEventsPage() {
  const resultInspector = useSourceInspector();
  const eventInspector = useSourceInspector();
  const resultSources = buildResultSourceRecords();
  const eventSources = buildEventSourceRecords();

  return (
    <div className="touchline mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a04-evidence-grammar" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A04 evidence grammar
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A04-S4 — Final score vs recorded event log</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{homeTeam} vs {awayTeam}</p>
      </div>

      <AppearanceControl />

      <EvidenceQuestionPanel
        question="What was the final score, and how complete is the recorded goal-by-goal timeline?"
        label="Match result"
        title={`Final score: ${finalScoreLabel()}`}
        valueCaption="Recorded from the canonical match result — not recomputed from the event log below."
        sample={`${homeTeam} vs ${awayTeam}`}
        coverage="COMPLETE"
        onInspect={resultInspector.open}
        inspectLabel="Inspect result source"
      />

      <EvidenceQuestionPanel
        question="Which individual goals were actually logged with a time?"
        label="Event log"
        title={`${eventLog.events.length} individually logged goal event`}
        visual={
          <ul className="flex flex-col gap-1.5" data-testid="s4-event-list">
            {eventLog.events.map((e) => (
              <li
                key={e.eventId}
                data-testid="s4-event-row"
                className="flex items-center justify-between rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-1.5 text-[12px] text-[var(--foreground)]"
              >
                <span>{e.type}</span>
                <span className="font-medium">{e.minute}&apos;</span>
              </li>
            ))}
          </ul>
        }
        valueCaption="The other goals in the 6–4 result were not individually logged — this timeline is incomplete, not empty."
        sample={`${homeTeam} vs ${awayTeam}`}
        coverage="PARTIAL"
        onInspect={eventInspector.open}
        inspectLabel="Inspect event source"
      />

      <SourceInspector
        isOpen={resultInspector.isOpen}
        onClose={resultInspector.close}
        title="A04-S4 result source"
        description="The canonical match result record — a separate source class from the event log below."
        sources={resultSources}
      />
      <SourceInspector
        isOpen={eventInspector.isOpen}
        onClose={eventInspector.close}
        title="A04-S4 event source"
        description="Individually logged match events — a separate source class from the canonical result above."
        sources={eventSources}
      />
    </div>
  );
}
