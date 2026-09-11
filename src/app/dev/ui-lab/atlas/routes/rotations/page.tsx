import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { TouchlineTimeline, TimelineItem } from "@/components/touchline/timeline/touchline-timeline";
import { PlanningReadinessWidget } from "@/components/touchline/widgets";
import { atlasNav, rotationPlanChanges, rotationDiagnostics } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Rotations — `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §D` (match-detail sub-tab).
 * Diagnostic text is reused verbatim from `generateRotationPlan()`/`checkPlannedRotationCoverage()`
 * (e.g. "No safe replacement for CB at 42 min") — never rewritten into blame language.
 */
export default function AtlasRotationsPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[720px]" navBuilder={atlasNav}>
      <TouchlinePageHeader title="Rotations" context="Rød vs Graabein United" actions={<TouchlineButton variant="secondary">Generate rotation plan</TouchlineButton>} />

      <div className="mt-5">
        <TouchlineTimeline aria-label="Planned rotation changes">
          {rotationPlanChanges.map((c, i) => (
            <TimelineItem key={c.id} timeLabel={c.atMinuteLabel} state={c.applied ? "done" : "next"} isLast={i === rotationPlanChanges.length - 1}>
              <p className="text-[15px] font-[600] text-[var(--foreground)]">{c.outPlayerName} off, {c.inPlayerName} on</p>
              <p className="text-[13px] text-[var(--text-muted)]">{c.role}{c.applied ? " · Applied" : ""}</p>
            </TimelineItem>
          ))}
        </TouchlineTimeline>
      </div>

      <div className="mt-6">
        <PlanningReadinessWidget
          checks={[
            { key: "starting-lineup", label: "Starting line-up set", complete: true },
            { key: "plan", label: "Rotation plan generated", complete: true },
          ]}
          warnings={rotationDiagnostics.map((d, i) => ({ id: String(i), text: d }))}
        />
      </div>
    </UiLabShell>
  );
}
