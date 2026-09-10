import {
  TouchlinePageHeader,
  EvidenceStory,
  PhaseDistribution,
  OutcomePair,
} from "@/components/touchline";
import { UiLabShell } from "../ui-lab-shells";

/**
 * Golden: insights-mobile (390×844).
 * Authored data-story grammar — each story answers one question, a Barlow
 * anchor number with prose, one purpose-built visual, explicit sample and
 * confidence. No metric-card dashboard, no radar/gauge, no good/bad colours,
 * no player ranking, correlational language only.
 */
export default function UiLabInsightsPage() {
  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[560px]">
      <TouchlinePageHeader title="Insights" context="G2015 · Autumn 2026" />

      <div className="mt-4 flex flex-col gap-3">
        <EvidenceStory
          question="When do goals against arrive across the match?"
          label="Match phases"
          title="Opening phases remain vulnerable"
          value="43%"
          valueCaption="of recorded goals against arrived in the opening phase"
          visual={
            <PhaseDistribution
              question="Goals against by match phase"
              unitLabel="goals"
              axisTicks={[0, 10, 20, 30, 40, 50]}
              segments={[
                { label: "Opening", value: 6, highlighted: true },
                { label: "10–20", value: 2 },
                { label: "20–30", value: 2 },
                { label: "30–40", value: 1 },
                { label: "40–50", value: 2 },
                { label: "50+", value: 1 },
              ]}
            />
          }
          sample="14 goals · 8 matches"
          confidence="Established"
        />

        <EvidenceStory
          question="What happened while one trio was on the field together?"
          label="Combinations"
          title="One trio coincided with more goals for"
          value={
            <>
              7 <span className="text-[14px] font-normal text-[var(--text-muted)]">for</span> 3{" "}
              <span className="text-[14px] font-normal text-[var(--text-muted)]">against</span>
            </>
          }
          visual={
            <OutcomePair
              question="Goals for vs against while the trio was on the field"
              forLabel="For"
              forValue={7}
              againstLabel="Against"
              againstValue={3}
            />
          }
          sample="6 shared on-field intervals"
          confidence="Emerging"
        />

        <EvidenceStory
          question="Where has this player spent recorded minutes?"
          label="Position exposure"
          title="Noah has most recorded time in wide roles"
          valueCaption=""
          visual={
            <p className="text-[15px] font-[620] tracking-wide text-[var(--accent)]">LW · LM · ST</p>
          }
          sample="11 matches · 327 recorded minutes"
          confidence={undefined}
        />
      </div>
    </UiLabShell>
  );
}
