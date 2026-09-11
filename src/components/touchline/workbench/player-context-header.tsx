import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PitchPlayerToken } from "@/components/touchline/pitch/pitch-player-token";

/**
 * PlayerContextHeader (Touchline Finish & Visual Convergence follow-up,
 * `03_CODE_CHANGE_MAP.md §H`) — the strong selected-player header used at the
 * top of `TouchlineInspector` (desktop) and the selected-player bottom sheet
 * (compact). One shared identity block so both surfaces present a selection
 * the same way.
 */
type Props = {
  name: string;
  role?: string;
  number?: string | number | null;
  /** e.g. "17 matches" — only already-available player context, never invented. */
  detail?: ReactNode;
  className?: string;
};

export function PlayerContextHeader({ name, role, number, detail, className }: Props) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <PitchPlayerToken name={name} number={number} compact showLabel={false} />
      <div className="min-w-0">
        <p className="text-[17px] font-[650] leading-tight text-[var(--foreground)]">{name}</p>
        {role ? <p className="mt-0.5 text-[13px] font-medium text-[var(--accent)]">{role}</p> : null}
        {detail ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{detail}</p> : null}
      </div>
    </div>
  );
}
