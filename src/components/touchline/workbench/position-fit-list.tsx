import { cn } from "@/lib/cn";
import { FIT_TIER_LABEL } from "@/domain/positions/labels";
import type { SuitabilityTier } from "@/domain/positions/matrix";

/**
 * PositionFitList (Touchline Finish & Visual Convergence follow-up,
 * `06_TACTICS_LINEUP_AND_PITCH.md §9`) — presentation-only rendering of the
 * canonical exact-position suitability output (ADR-0129). Display order is
 * fixed: Natural → Strong → Plausible → Developmental → Outside automatic
 * fit. Automatic/manual eligibility behaviour is unchanged elsewhere; this
 * component only presents the tier the domain layer already computed.
 */
const TIER_ORDER: SuitabilityTier[] = ["NATURAL", "STRONG", "PLAUSIBLE", "DEVELOPMENTAL", "UNSUPPORTED"];

const TIER_DESCRIPTION: Record<SuitabilityTier, string> = {
  NATURAL: "Preferred position, high familiarity",
  STRONG: "Well-suited, proven in this role",
  PLAUSIBLE: "Can play here, lower familiarity",
  DEVELOPMENTAL: "Outside the usual automatic range for this role",
  UNSUPPORTED: "Not currently within the automatic fit range",
};

export type PositionFitEntry = {
  tier: SuitabilityTier;
  /** Exact role code(s) this tier applies to, e.g. ["LW"] or ["LWB", "AM"]. */
  roles: string[];
};

type Props = {
  entries: PositionFitEntry[];
  selectedTier?: SuitabilityTier;
  onSelectTier?: (tier: SuitabilityTier) => void;
  className?: string;
};

export function PositionFitList({ entries, selectedTier, onSelectTier, className }: Props) {
  const byTier = new Map(entries.map((e) => [e.tier, e]));
  const ordered = TIER_ORDER.map((tier) => byTier.get(tier)).filter((e): e is PositionFitEntry => e != null);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        Positional fit
      </p>
      {ordered.map((entry) => {
        const selected = entry.tier === selectedTier;
        const Tag = onSelectTier ? "button" : "div";
        return (
          <Tag
            key={entry.tier}
            {...(onSelectTier
              ? { type: "button" as const, onClick: () => onSelectTier(entry.tier) }
              : {})}
            className={cn(
              "flex items-center gap-3 rounded-[var(--tl-radius-widget)] border px-3.5 py-2.5 text-left transition-colors duration-[var(--tl-c-motion-state)]",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                : "border-[var(--border-soft)] bg-[var(--tl-widget)]",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border-strong)]",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-[600] text-[var(--foreground)]">
                {FIT_TIER_LABEL[entry.tier]}
              </span>
              <span className="block text-[12px] text-[var(--text-muted)]">{TIER_DESCRIPTION[entry.tier]}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              {entry.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[11px] font-semibold uppercase text-[var(--text-soft)]"
                >
                  {role}
                </span>
              ))}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
