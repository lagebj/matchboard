/**
 * Today "Other attention" section (ADR-0142 `02_PRODUCTION_COMPOSITION_CONTRACT.md` "Other
 * attention"). Compact rows for non-plan-integrity work items — event setup, peer review, older
 * report completion, other concrete setup/follow-up tasks. Shows the actual item, never only its
 * category count. `blocked_round`/`decision_required` categories are never rendered here — those
 * are always represented by Planning attention / Selection decisions instead (they are always
 * exactly an aggregation of the same `roundPlanIntegrities` signals).
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import type { AssistantWorkItem } from "@/lib/assistant/types";
import { TouchlineButton } from "@/components/touchline";

const OTHER_ATTENTION_CATEGORIES: ReadonlySet<AssistantWorkItem["category"]> = new Set([
  "setup_missing",
  "availability_missing",
  "populate_needed",
  "event_setup_missing",
  "event_squads_missing",
  "event_lineup_missing",
  "event_helpers_missing",
  "event_report_needed",
  "event_report_incomplete",
  "review_assigned",
  "review_changes_requested",
  "post_match_report",
  "planned_rotation_delayed",
]);

export function selectTodayOtherAttentionItems(
  items: AssistantWorkItem[],
  excludeIds: ReadonlySet<string>,
): AssistantWorkItem[] {
  return items.filter((item) => OTHER_ATTENTION_CATEGORIES.has(item.category) && !excludeIds.has(item.id));
}

export function TodayOtherAttention({ items }: { items: AssistantWorkItem[] }) {
  if (items.length === 0) return null;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title="Other attention"
        description="Setup, events, and reporting follow-up."
        eyebrow={`${items.length} item${items.length === 1 ? "" : "s"}`}
      />
      <ul className="flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-[var(--surface-muted)]/30 transition-colors"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-[var(--foreground)] truncate">{item.title}</span>
              {item.summary && (
                <span className="text-xs text-[var(--text-muted)] line-clamp-1">{item.summary}</span>
              )}
            </div>
            <TouchlineButton
              as={Link}
              href={item.primaryActionHref}
              variant="ghost"
              size="sm"
              trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
            >
              {item.primaryActionLabel}
            </TouchlineButton>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
