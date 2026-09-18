import Link from "next/link";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { TouchlineButton } from "@/components/touchline";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import type { MatchDetailAfterData } from "@/lib/matches/get-match-detail-after-data";
import { useUnresolvedLiveActionState } from "@/components/live-match/use-unresolved-live-action-state";

/**
 * "After match" tab (`04_MATCH_DETAILS_AFTER_MATCH_SPEC.md`): "Compact report status, integrity
 * status, reflection/observation summary and deep link to `/post-match`." An entry/summary
 * surface, never a clone of the report editor — mutation stays in `/post-match`
 * (`02_PRODUCT_MODEL_AND_LIFECYCLE.md`).
 */
export function MatchAfterMatchPanel({ matchId, data }: { matchId: string; data: MatchDetailAfterData }) {
  const orgUrl = useOrgUrl();
  const unresolved = useUnresolvedLiveActionState(matchId);
  const isLocked = data.reportStatus === "LOCKED";

  return (
    <div className="flex flex-col gap-4">
      {!isLocked && unresolved.actionableCount > 0 && (
        <DecisionBanner
          variant="decision"
          title="Report integrity needs attention"
          description={`${unresolved.actionableCount} recorded live action${unresolved.actionableCount === 1 ? "" : "s"} on this device need review before this report can be trusted as complete.`}
          action={
            <TouchlineButton as={Link} href={orgUrl(`/matches/${matchId}/post-match`)} variant="primary" size="sm">
              Review issues
            </TouchlineButton>
          }
        />
      )}
      {!isLocked && data.goalAttributionGap?.hasGap && (
        <DecisionBanner
          variant="decision"
          title="Goal attribution gap"
          description={`${data.goalAttributionGap.liveGoalsRecorded} live goals recorded, ${data.goalAttributionGap.attributedGoals} attributed.`}
        />
      )}

      <Surface padding="md">
        <SectionHeader
          title="Report status"
          description={
            isLocked
              ? `Locked${data.completedAt ? ` · completed ${new Date(data.completedAt).toLocaleDateString("en-GB")}` : ""}.`
              : "Report is still being reconciled."
          }
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SummaryRow label="Team reflection" value={data.reflection ? "Complete" : "Not recorded"} />
          <SummaryRow label="Football observations" value={String(data.footballObservations.length)} />
          <SummaryRow label="Timing review" value={data.timingNeedsReviewCount > 0 ? `${data.timingNeedsReviewCount} need review` : "Clear"} />
          <SummaryRow label="Out-of-range events" value={String(data.outOfRangeEventCount)} />
        </div>
        <TouchlineButton as={Link} href={orgUrl(`/matches/${matchId}/post-match`)} variant={isLocked ? "secondary" : "primary"} size="md" className="mt-4 self-start">
          {isLocked ? "View full report" : "Continue report"}
        </TouchlineButton>
      </Surface>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-[var(--surface-muted)]/30 px-3 py-2 text-[13px]">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="font-medium text-[var(--foreground)]">{value}</span>
    </div>
  );
}
