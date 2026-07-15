"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { OverrideReasonInput } from "@/components/round/override-reason-input";
import { signalCategoryFromSeverity } from "@/lib/selection/signal-category";
import { Dialog } from "@/components/ui/dialog";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";

type SignalSummary = {
  severity: string;
  message: string;
  rule: string;
};

type ConfirmFinalizeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (overrideReasonCategory: string, overrideReasonDetail: string) => void;
  blockedCount: number;
  decisionRequiredCount: number;
  selectedCount: number;
  targetSquadSize: number;
  matchCount: number;
  signals?: SignalSummary[];
};

export function ConfirmFinalizeDialog({
  isOpen,
  onClose,
  onConfirm,
  blockedCount,
  decisionRequiredCount,
  selectedCount,
  targetSquadSize,
  matchCount,
  signals = [],
}: ConfirmFinalizeDialogProps) {
  const [overrideReason, setOverrideReason] = useState({ category: "", detail: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasIssues = blockedCount > 0 || decisionRequiredCount > 0;
  const categoryValid = !hasIssues || overrideReason.category !== "";
  const detailValid = !hasIssues || overrideReason.detail.trim().length >= 10;
  const overrideValid = !hasIssues || (categoryValid && detailValid);

  const blockedConditions = signals.filter(
    (s) =>
      signalCategoryFromSeverity(
        s.severity as Parameters<typeof signalCategoryFromSeverity>[0],
      ) === "BLOCKED",
  );
  const decisionRequiredConditions = signals.filter(
    (s) =>
      signalCategoryFromSeverity(
        s.severity as Parameters<typeof signalCategoryFromSeverity>[0],
      ) === "DECISION_REQUIRED",
  );

  const handleConfirm = () => {
    if (!overrideValid) return;
    setIsSubmitting(true);
    onConfirm(overrideReason.category, overrideReason.detail.trim());
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Finalise round"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leadingIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            onClick={handleConfirm}
            disabled={!overrideValid || isSubmitting}
          >
            {isSubmitting ? "Finalising…" : "Finalise round"}
          </Button>
        </>
      }
    >
      <Surface variant="subtle" padding="md">
        <p className="text-sm text-[var(--text-soft)]">
          <span className="font-semibold text-zinc-100">{selectedCount}</span> players selected
          across <span className="font-semibold text-zinc-100">{matchCount}</span>{" "}
          match{matchCount !== 1 ? "es" : ""}, targeting{" "}
          <span className="font-semibold text-zinc-100">{targetSquadSize}</span>{" "}
          squad size.
        </p>
      </Surface>

      {!hasIssues && (
        <DecisionBanner
          variant="success"
          title="Plan checks pass"
          description="All available eligible players have one planned match opportunity. All squads meet minimum size."
        />
      )}

      {blockedCount > 0 && (
        <DecisionBanner
          variant="blocked"
          title={
            <>
              {blockedCount} blocked{" "}
              {blockedCount === 1 ? "condition" : "conditions"}
            </>
          }
          description="An override reason is required to finalise."
        />
      )}

      {blockedConditions.length > 0 && (
        <ul className="ml-6 -mt-2 list-disc text-xs text-[var(--danger)]/85 space-y-0.5">
          {blockedConditions.map((s, i) => (
            <li key={i}>{s.message}</li>
          ))}
        </ul>
      )}

      {decisionRequiredCount > 0 && (
        <DecisionBanner
          variant="decision"
          title={
            <>
              {decisionRequiredCount}{" "}
              {decisionRequiredCount === 1
                ? "decision needs review"
                : "decisions need review"}
            </>
          }
          description="An override reason is required to finalise."
        />
      )}

      {decisionRequiredConditions.length > 0 && (
        <ul className="ml-6 -mt-2 list-disc text-xs text-[var(--warning)]/85 space-y-0.5">
          {decisionRequiredConditions.map((s, i) => (
            <li key={i}>{s.message}</li>
          ))}
        </ul>
      )}

      <OverrideReasonInput
        hasBlockingWarnings={hasIssues}
        value={overrideReason}
        onChange={setOverrideReason}
      />
    </Dialog>
  );
}
