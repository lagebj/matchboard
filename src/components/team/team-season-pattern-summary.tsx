import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { StatusPill } from "@/components/ui/status-pill";
import type { PatternViewModel } from "@/lib/team-season-profile/presentation";

/**
 * Compact "Season patterns" surface shown between the Team Detail header and the tab rail
 * (ADR-0156 §07 §3). At most 3 patterns, deterministic — the caller (`team-detail.tsx`) already
 * sliced and ranked them via `selectTopPatternKeys()`. Renders nothing when there are none
 * (ADR-0156 §07 §3: shown "when at least one EMERGING or ESTABLISHED pattern exists").
 */
export function TeamSeasonPatternSummary({ patterns, viewPatternsHref }: { patterns: PatternViewModel[]; viewPatternsHref: string }) {
  if (patterns.length === 0) return null;

  return (
    <section aria-labelledby="season-patterns-heading">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div id="season-patterns-heading" className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Season patterns
          </div>
          <p className="text-xs text-[var(--text-soft)] mt-0.5">Evidence-backed patterns from completed matches</p>
        </div>
        <Link href={viewPatternsHref} className="text-xs font-medium text-[var(--accent-strong)] hover:underline whitespace-nowrap">
          View patterns →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        {patterns.map((pattern) => (
          <Surface key={pattern.key} variant="default" padding="md" className="flex flex-col gap-1.5">
            <div className="text-sm font-semibold text-[var(--foreground)]">{pattern.title}</div>
            <p className="text-xs text-[var(--text-soft)] leading-snug">{pattern.evidenceSentence}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusPill variant={pattern.confidenceLabel === "Established pattern" ? "success" : "info"} size="sm">
                {pattern.confidenceLabel}
              </StatusPill>
              {pattern.trajectoryLabel && <span className="text-[11px] text-[var(--text-muted)]">{pattern.trajectoryLabel}</span>}
            </div>
          </Surface>
        ))}
      </div>
    </section>
  );
}
