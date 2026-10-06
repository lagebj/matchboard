"use client";

import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import type { PatternViewModel } from "@/lib/team-season-profile/presentation";

/**
 * Deep Patterns view (ADR-0156 §07 §5): season context header, strongest patterns (max 5), then
 * one section per family. A family section renders nothing at all when it has no surfaceable
 * patterns (§07 §10: "Do not render an empty family section") — only the top-level empty/sparse
 * states below ever explain an absence.
 */
export type TeamPatternsTabData = {
  seasonLabel: string;
  completedMatches: number;
  hasApproximateTiming: boolean;
  strongest: PatternViewModel[];
  rhythm: PatternViewModel[];
  themes: PatternViewModel[];
  playerContributions: PatternViewModel[];
  combinations: PatternViewModel[];
  /** ADR-0156 §06 §7: up to 2 current/recent ACTIVE weekly-review insights, never generated for
   * this page -- `null` when no successful weekly review exists yet for this team. */
  weeklyExcerpt: { reviewHref: string; insights: Array<{ title: string; body: string }> } | null;
};

function PatternCard({ pattern }: { pattern: PatternViewModel }) {
  const orgUrl = useOrgUrl();
  const toneTextClass = pattern.tone === "ATTENTION" ? "text-[var(--warning)]" : pattern.tone === "POSITIVE" ? "text-[var(--accent-strong)]" : "text-[var(--foreground)]";

  // Player Detail link is required for single-player (PLAYER_CONTRIBUTION) cards and optional
  // for multi-player COMBINATION cards (ADR-0156 §07 §8/§9) -- a combination title already names
  // every player as plain text, which is sufficient for that "optional" case without needing to
  // re-structure the title string into individually-linkable name fragments.
  const isSinglePlayerCard = pattern.family === "PLAYER_CONTRIBUTION" && pattern.playerIds.length === 1;

  return (
    <Surface variant="default" padding="md" className="flex flex-col gap-1.5">
      <div className={`text-sm font-semibold ${toneTextClass}`}>
        {isSinglePlayerCard ? (
          <Link href={orgUrl(`/players/${pattern.playerIds[0]}`)} className="text-[var(--accent-strong)] hover:underline">
            {pattern.title}
          </Link>
        ) : (
          pattern.title
        )}
      </div>
      <p className="text-xs text-[var(--text-soft)] leading-snug">{pattern.evidenceSentence}</p>
      {pattern.secondarySentence && <p className="text-xs text-[var(--text-muted)] leading-snug">{pattern.secondarySentence}</p>}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <StatusPill variant={pattern.confidenceLabel === "Established pattern" ? "success" : "info"} size="sm">
          {pattern.confidenceLabel}
        </StatusPill>
        {pattern.trajectoryLabel && <span className="text-[11px] text-[var(--text-muted)]">{pattern.trajectoryLabel}</span>}
        <span className="text-[11px] text-[var(--text-muted)]">{pattern.sampleLine}</span>
        {pattern.approximateTiming && <span className="text-[11px] text-[var(--text-muted)]">· Some timing approximate</span>}
      </div>
    </Surface>
  );
}

function FamilySection({ title, lead, patterns }: { title: string; lead: string; patterns: PatternViewModel[] }) {
  if (patterns.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="text-xs text-[var(--text-muted)] mt-0.5 mb-3">{lead}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {patterns.map((pattern) => (
          <PatternCard key={pattern.key} pattern={pattern} />
        ))}
      </div>
      {title === "Combinations" && patterns.length > 0 && <p className="text-[11px] text-[var(--text-muted)] mt-2">Association, not causation.</p>}
    </section>
  );
}

export function TeamPatternsTab({ data }: { data: TeamPatternsTabData }) {
  if (data.completedMatches === 0) {
    return <EmptyState title="No completed matches in this season" description="Season patterns will appear once completed-match evidence is available." />;
  }

  const hasAnyPattern = data.rhythm.length > 0 || data.themes.length > 0 || data.playerContributions.length > 0 || data.combinations.length > 0;
  if (!hasAnyPattern) {
    return (
      <EmptyState
        title="Season patterns will appear as completed-match evidence builds."
        description={`${data.completedMatches} completed match${data.completedMatches === 1 ? "" : "es"} so far this season — not yet enough for a surfaceable pattern.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div>
        <div className="text-sm text-[var(--text-soft)]">
          {data.seasonLabel} · {data.completedMatches} completed match{data.completedMatches === 1 ? "" : "es"}
        </div>
        {data.hasApproximateTiming && <p className="text-xs text-[var(--text-muted)] mt-0.5">Some timing is approximate.</p>}
      </div>

      {data.strongest.length > 0 && (
        <section className="mt-5">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Strongest patterns</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {data.strongest.map((pattern) => (
              <PatternCard key={pattern.key} pattern={pattern} />
            ))}
          </div>
        </section>
      )}

      <FamilySection title="Match rhythm" lead="Where goals have accumulated within the team's recorded match phases." patterns={data.rhythm} />
      <FamilySection title="Tactical themes" lead="Structured coach observations across the selected season." patterns={data.themes} />
      <FamilySection title="Player contributions" lead="Goal and assist contributions, normalized by actual exposure." patterns={data.playerContributions} />
      <FamilySection title="Combinations" lead="Repeated partnership, corridor, triangle and unit evidence." patterns={data.combinations} />

      {data.weeklyExcerpt && (
        <section className="mt-6">
          <Surface variant="info" padding="md" className="flex flex-col gap-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Assistant Coach · Latest weekly review</div>
            {data.weeklyExcerpt.insights.map((insight) => (
              <div key={insight.title}>
                <div className="text-sm font-semibold text-[var(--foreground)]">{insight.title}</div>
                <p className="text-xs text-[var(--text-soft)] leading-snug">{insight.body}</p>
              </div>
            ))}
            <Link href={data.weeklyExcerpt.reviewHref} className="text-xs font-medium text-[var(--accent-strong)] hover:underline w-fit">
              Open Team Review →
            </Link>
          </Surface>
        </section>
      )}
    </div>
  );
}
