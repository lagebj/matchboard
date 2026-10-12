import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { CoachNoteCard, ExtractedObservationCard } from "../shared/qualitative-evidence-review";
import { identity, coachNote, extraction, playerNameByRef } from "./fixtures";
import { W4_PLAYER_NAME, W4_PLAYER_SHIRT_NUMBER } from "../../shared/w4-assistant-coach-fixture";

/**
 * A11-coach-text-and-parsed-evidence — the coach's original note stays immutable and visible
 * alongside its parsed observations; parsing structures what the coach already said, it never
 * adds a new claim, invents a diagnosis, or infers a pronoun-only player identity.
 */
export default function A11CoachTextAndParsedEvidencePage() {
  return (
    <div className="touchline mx-auto flex max-w-[640px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a11-qualitative-evidence-and-mutation" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A11 Qualitative evidence + mutation
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A11 — Coach text and parsed evidence</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{identity.fixedDateTimeUtc}</p>
      </div>

      <AppearanceControl />

      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Player Detail</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">
          {W4_PLAYER_NAME} · №{W4_PLAYER_SHIRT_NUMBER}
        </p>
      </div>

      <CoachNoteCard authorLabel={coachNote.authorLabel} occurredAtLabel={coachNote.occurredAtLabel} text={coachNote.text} />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Parsed observations (AI_STRUCTURED, not AI inference)</p>
        {extraction.observations.map((observation, index) => (
          <ExtractedObservationCard key={`${observation.statement}-${index}`} observation={observation} playerNameByRef={playerNameByRef} />
        ))}
      </div>

      <p className="text-[11px] text-[var(--text-muted)]" data-testid="fixture-simulation-caption">
        Fixture-only pre-validated extraction output · No provider call made · Parsing, not inference.
      </p>
    </div>
  );
}
