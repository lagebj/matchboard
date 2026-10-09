"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { TouchlineButton } from "@/components/touchline";
import { PROFILE_POSITIONS, type ProfilePosition } from "../shared/profile-position-model";
import { ProfilePositionSelector } from "./profile-position-selector";
import {
  type ProfilePositionTriple,
  setPrimary,
  setSecondary,
  setTertiary,
  availableOptionsFor,
} from "./profile-triple-selection";

/**
 * `ProfilePositionTripleEditor` — A12 UI Lab candidate only (PR #777 remediation).
 *
 * Interaction pattern confirmed against F1 Study 02 (directional study, programme_v054
 * `directional_studies_not_goldens/`): a compact read summary by default ("Primary: CM ·
 * Secondary: — · Tertiary: —", mirroring the study's read-only Overview tab), expanding — only
 * on request — to three parallel PRIMARY/SECONDARY/TERTIARY selects above the full always-visible
 * 14-role button grid (mirroring the study's Manage tab, where the grid button matching the
 * current Primary selection is highlighted). The grid always sets Primary, exactly as in the
 * study; Secondary/Tertiary are set via their own selects. No production wiring — selecting a
 * position here writes nothing.
 */
const SELECT_CLASS =
  "h-8 w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent-strong)] focus:ring-1 focus:ring-[var(--accent-strong)]";

type Props = {
  value: ProfilePositionTriple;
  onChange: (value: ProfilePositionTriple) => void;
  className?: string;
};

function summaryLabel(position: ProfilePosition | null): string {
  return position ?? "—";
}

export function ProfilePositionTripleEditor({ value, onChange, className }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        <p className="text-[13px] text-[var(--foreground)]">
          Primary: <span className="font-medium">{summaryLabel(value.primary)}</span> · Secondary:{" "}
          <span className="font-medium">{summaryLabel(value.secondary)}</span> · Tertiary:{" "}
          <span className="font-medium">{summaryLabel(value.tertiary)}</span>
        </p>
        <TouchlineButton type="button" variant="secondary" size="sm" onClick={() => setExpanded(true)}>
          Edit
        </TouchlineButton>
      </div>
    );
  }

  const secondaryOptions = availableOptionsFor("secondary", value, PROFILE_POSITIONS);
  const tertiaryOptions = availableOptionsFor("tertiary", value, PROFILE_POSITIONS);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Primary</span>
          <select
            className={SELECT_CLASS}
            value={value.primary}
            onChange={(e) => onChange(setPrimary(value, e.target.value as ProfilePosition))}
          >
            {PROFILE_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Secondary</span>
          <select
            className={SELECT_CLASS}
            value={value.secondary ?? ""}
            onChange={(e) => onChange(setSecondary(value, e.target.value === "" ? null : (e.target.value as ProfilePosition)))}
          >
            <option value="">— None —</option>
            {secondaryOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Tertiary</span>
          <select
            className={SELECT_CLASS}
            value={value.tertiary ?? ""}
            onChange={(e) => onChange(setTertiary(value, e.target.value === "" ? null : (e.target.value as ProfilePosition)))}
          >
            <option value="">— None —</option>
            {tertiaryOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ProfilePositionSelector value={value.primary} onChange={(p) => onChange(setPrimary(value, p))} />

      <div>
        <TouchlineButton type="button" variant="secondary" size="sm" onClick={() => setExpanded(false)}>
          Done
        </TouchlineButton>
      </div>
    </div>
  );
}
