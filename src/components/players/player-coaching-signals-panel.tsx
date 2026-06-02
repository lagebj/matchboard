"use client";

import { TacticalSurface } from "@/components/ui/tactical-surface";
import { SectionHeader } from "@/components/ui/section-header";
import { InlineEditSegmented } from "@/components/ui/inline-edit-segmented";
import {
  READINESS_SIGNAL_TYPES,
  type ReadinessSignalType,
  type ReadinessSignalValue,
} from "@/lib/coaching/types";
import { setReadinessSignalAction, deleteReadinessSignalAction } from "@/app/(app)/players/[playerId]/coaching-actions/actions";
import { useTransition } from "react";

type ReadinessSignal = {
  id: string;
  signalType: ReadinessSignalType;
  value: ReadinessSignalValue;
  note: string | null;
};

type PlayerCoachingSignalsPanelProps = {
  playerId: string;
  signals: ReadinessSignal[];
};

const EFFORT_TREND_OPTIONS = [
  { label: "Rising", value: "RISING" },
  { label: "Stable", value: "STABLE" },
  { label: "Falling", value: "FALLING" },
];

const TERNARY_SKILL_OPTIONS = [
  { label: "Strong", value: "STRONG" },
  { label: "OK", value: "OK" },
  { label: "Needs attention", value: "NEEDS_ATTENTION" },
];

const TRUST_OPTIONS = [
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" },
];

const ATTENDANCE_OPTIONS = [
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" },
];

const TONE_MAP: Record<string, Record<string, "neutral" | "success" | "warning" | "danger" | "info">> = {
  EFFORT_TREND: { RISING: "success", STABLE: "neutral", FALLING: "danger" },
  ATTENDANCE_RELIABILITY: { HIGH: "success", MEDIUM: "warning", LOW: "danger" },
  LEARNING_BEHAVIOR: { STRONG: "success", OK: "neutral", NEEDS_ATTENTION: "danger" },
  TEAM_FIRST_BEHAVIOR: { STRONG: "success", OK: "neutral", NEEDS_ATTENTION: "danger" },
  RESET_AFTER_ERROR_RELIABILITY: { STRONG: "success", OK: "neutral", NEEDS_ATTENTION: "danger" },
  COACH_TRUST: { HIGH: "success", MEDIUM: "warning", LOW: "danger" },
};

function getOptionsForType(type: ReadinessSignalType) {
  switch (type) {
    case "EFFORT_TREND": return EFFORT_TREND_OPTIONS;
    case "ATTENDANCE_RELIABILITY": return ATTENDANCE_OPTIONS;
    case "LEARNING_BEHAVIOR": return TERNARY_SKILL_OPTIONS;
    case "TEAM_FIRST_BEHAVIOR": return TERNARY_SKILL_OPTIONS;
    case "RESET_AFTER_ERROR_RELIABILITY": return TERNARY_SKILL_OPTIONS;
    case "COACH_TRUST": return TRUST_OPTIONS;
  }
}

function getLabelForType(type: ReadinessSignalType): string {
  switch (type) {
    case "EFFORT_TREND": return "Effort trend";
    case "ATTENDANCE_RELIABILITY": return "Attendance";
    case "LEARNING_BEHAVIOR": return "Learning";
    case "TEAM_FIRST_BEHAVIOR": return "Team-first";
    case "RESET_AFTER_ERROR_RELIABILITY": return "Reset after error";
    case "COACH_TRUST": return "Coach trust";
  }
}

export function PlayerCoachingSignalsPanel({ playerId, signals }: PlayerCoachingSignalsPanelProps) {
  const [isPending, startTransition] = useTransition();

  const signalMap = new Map(signals.map((s) => [s.signalType, s]));

  const handleSave = (signalType: ReadinessSignalType) => async (nextValue: string) => {
    startTransition(async () => {
      await setReadinessSignalAction(playerId, signalType, nextValue as ReadinessSignalValue, null);
    });
  };

  const _handleClear = (signalType: ReadinessSignalType) => async () => {
    startTransition(async () => {
      await deleteReadinessSignalAction(playerId, signalType);
    });
  };

  return (
    <TacticalSurface variant="default" padding="md">
      <SectionHeader title="Current coaching signals" />
      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
        Temporary coaching context. Not permanent evaluation.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {READINESS_SIGNAL_TYPES.map((type) => {
          const signal = signalMap.get(type);
          const value = signal?.value ?? null;
          const options = getOptionsForType(type);

          return (
            <InlineEditSegmented
              key={type}
              label={getLabelForType(type)}
              value={value}
              options={options}
              onSave={handleSave(type)}
              toneMap={TONE_MAP[type]}
              disabled={isPending}
            />
          );
        })}
      </div>
    </TacticalSurface>
  );
}