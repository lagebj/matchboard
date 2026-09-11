import { TouchlineButton, TouchlinePageHeader } from "@/components/touchline";
import {
  NextMatchHero,
  AttentionWidget,
  SquadReadinessWidget,
  RecentFootballWidget,
  ScheduleWidget,
  EvidenceSpotlightWidget,
  ParticipationLoadWidget,
  RoleUsageWidget,
  MovementHistoryWidget,
  OpportunityWidget,
  PositionExposureWidget,
  EventDayWidget,
  PlanningReadinessWidget,
} from "@/components/touchline/widgets";
import { Sparkline, MiniBars, StackedDistribution, PhaseBars, PitchExposure, TimelineStrip, RangeBand, DotComparison, OutcomePair } from "@/components/touchline/viz";
import { UiLabShell } from "../../ui-lab-shells";
import { atlasNav, recentMatches, historyViewModel, playerDetailViewModel } from "../fixtures";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * Phase 2 gate: every semantic widget + viz primitive the Touchline Design Atlas requires,
 * demoed with fixture data matching the real view-model schemas
 * (`13_IMPLEMENTATION_PHASES_AND_GATES.md` Phase 2).
 */
export default function AtlasComponentsGalleryPage() {
  return (
    <UiLabShell activeKey="more" contentWidthClass="max-w-[860px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Atlas components" context="Semantic widget + viz primitive gallery (Phase 2 gate)" />

      <Section title="NextMatchHero">
        <NextMatchHero
          presentation={recentMatches[0]}
          contextLabel="G2015 · League"
          contextLine="Slemmestad · Pitch 1"
          primaryAction={<TouchlineButton variant="primary">Match details →</TouchlineButton>}
        />
      </Section>

      <Section title="AttentionWidget">
        <AttentionWidget
          items={[
            { id: "1", title: "Squad below minimum", summary: "Hvit vs Tofte needs 2 more players", urgency: "IMMEDIATE" },
            { id: "2", title: "Decision required", summary: "Elias has no planned opportunity", urgency: "NORMAL" },
          ]}
          overflowCount={2}
        />
      </Section>

      <Section title="SquadReadinessWidget">
        <SquadReadinessWidget
          available={18}
          doubtful={2}
          unavailable={1}
          exceptions={[{ playerId: "1", displayName: "Oliver Hansen", reason: "Injured" }]}
        />
      </Section>

      <Section title="RecentFootballWidget">
        <RecentFootballWidget matches={recentMatches} />
      </Section>

      <Section title="ScheduleWidget">
        <ScheduleWidget
          items={[
            { id: "1", timeLabel: "17:30", title: "Training", state: "later" },
            { id: "2", timeLabel: "Sat 13:00", title: "Rød match", sublabel: "2 planning decisions", state: "current" },
          ]}
        />
      </Section>

      <Section title="EvidenceSpotlightWidget">
        <EvidenceSpotlightWidget
          question="How often do goals against arrive in the opening phase?"
          label="Opening phases"
          title="Opening phases remain vulnerable"
          value="43%"
          sample="14 goals · 8 matches"
          confidence="Established"
          detailHref="#"
        />
      </Section>

      <Section title="ParticipationLoadWidget">
        <ParticipationLoadWidget distribution={historyViewModel.appearanceDistribution.map((b) => ({ label: b.label, value: b.count }))} loadRange={historyViewModel.loadRange} />
      </Section>

      <Section title="RoleUsageWidget">
        <RoleUsageWidget counts={{ core: 31, support: 8, development: 2, squadRepair: 1 }} />
      </Section>

      <Section title="MovementHistoryWidget">
        <MovementHistoryWidget
          strip={[
            { id: "1", label: "Elias D.", sublabel: "Hvit → Rød", tone: "accent" },
            { id: "2", label: "Sander A.", sublabel: "Blå → Blå", tone: "neutral" },
          ]}
          recentRows={[{ id: "1", playerName: "Elias Dahl", fromTeamName: "Hvit", toTeamName: "Rød", role: "Support", roundLabel: "W35" }]}
        />
      </Section>

      <Section title="OpportunityWidget">
        <OpportunityWidget {...playerDetailViewModel.opportunity!} />
      </Section>

      <Section title="PositionExposureWidget">
        <PositionExposureWidget entries={playerDetailViewModel.positionExposure.map((p) => ({ code: p.code, sharePercent: p.sharePercent }))} />
      </Section>

      <Section title="EventDayWidget">
        <EventDayWidget
          items={[
            { id: "1", timeLabel: "11:00", title: "vs Skrim United", state: "current" },
            { id: "2", timeLabel: "13:00", title: "vs Bærum SK", state: "next" },
          ]}
        />
      </Section>

      <Section title="PlanningReadinessWidget">
        <PlanningReadinessWidget
          checks={[
            { key: "squad", label: "Squad populated", complete: true },
            { key: "lineup", label: "Lineup created", complete: true },
            { key: "report", label: "Report submitted", complete: false },
          ]}
          warnings={[{ id: "1", text: "No safe replacement for LW at 22 min" }]}
        />
      </Section>

      <Section title="Viz primitives">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">Sparkline</p>
            <Sparkline question="Trend" values={[2, 4, 3, 5, 6]} />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">MiniBars</p>
            <MiniBars question="Counts" segments={[{ label: "A", value: 3 }, { label: "B", value: 7, highlighted: true }, { label: "C", value: 2 }]} />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">StackedDistribution</p>
            <StackedDistribution question="Shares" segments={[{ label: "Core", value: 31 }, { label: "Support", value: 8 }]} />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">PhaseBars</p>
            <PhaseBars question="Phases" segments={[{ label: "0-10", value: 6, highlighted: true }, { label: "10-20", value: 3 }]} />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">PitchExposure</p>
            <PitchExposure question="Exposure" entries={[{ code: "LW", sharePercent: 68 }, { code: "ST", sharePercent: 32 }]} />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">TimelineStrip</p>
            <TimelineStrip question="Movement" entries={[{ id: "1", label: "Noah", sublabel: "W34", tone: "accent" }]} />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">RangeBand</p>
            <RangeBand question="Load" value={9} min={0} max={14} rangeLow={6} rangeHigh={11} sampleContext="Team's own season range" />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">DotComparison</p>
            <DotComparison question="Planned vs realised" leftLabel="Planned" leftValue={6} rightLabel="Realised" rightValue={5} />
          </div>
          <div>
            <p className="mb-1 text-[12px] text-[var(--text-muted)]">OutcomePair</p>
            <OutcomePair question="For vs against" forLabel="For" forValue={6} againstLabel="Against" againstValue={3} />
          </div>
        </div>
      </Section>
    </UiLabShell>
  );
}
