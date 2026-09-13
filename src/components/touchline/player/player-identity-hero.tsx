import type { ReactNode } from "react";
import { MoreHorizontal, ChevronLeft } from "lucide-react";
import { TeamKitMark } from "@/components/touchline/identity/team-kit-mark";
import type { PlayerIdentityViewModel } from "@/lib/touchline/presentation/player-identity-view-model";

/**
 * `PlayerIdentityHero` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §2`). Persistent identity
 * header, stable across all tabs — decorative photo replaced by the generated shirt mark
 * (contract §1, `05_SHIRT_IDENTITY_AND_TEAM_KIT_COLOR.md`). No photo upload.
 */
export type PlayerIdentityHeroProps = {
  identity: PlayerIdentityViewModel;
  onBack?: () => void;
  onOverflow?: () => void;
  /**
   * Custom overflow content (Phase F8 production use): when provided, renders in place of the
   * default "More actions" button so the production page can host its own menu (prev/next
   * player navigation, lifecycle actions) inside the same gate-approved chrome. UI Lab fixtures
   * omit it and keep the original button.
   */
  overflow?: ReactNode;
};

const AVAILABILITY_TONE_CLASS: Record<PlayerIdentityViewModel["availabilityTone"], string> = {
  positive: "text-[var(--accent-strong)]",
  neutral: "text-[var(--text-soft)]",
  attention: "text-[var(--warning)]",
};

export function PlayerIdentityHero({ identity, onBack, onOverflow, overflow }: PlayerIdentityHeroProps) {
  const secondaryLine = identity.secondaryPositions.length > 0 ? identity.secondaryPositions.join(" · ") : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        {overflow ?? (
          <button
            type="button"
            onClick={onOverflow}
            aria-label="More actions"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-soft)] hover:bg-[var(--surface-hover)]"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex items-start gap-4">
        <TeamKitMark
          color={identity.kitColor}
          number={identity.shirtNumber}
          size="hero"
          ariaLabel={`${identity.displayName}'s shirt${identity.shirtNumber != null ? `, number ${identity.shirtNumber}` : ""}`}
        />
        <div className="min-w-0 flex-1">
          {identity.groupLabel ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {identity.coreTeamName}
              {identity.coreTeamName && identity.groupLabel ? <br /> : null}
              {identity.groupLabel}
            </p>
          ) : null}
          <h1 className="mt-1 text-[26px] font-[700] leading-tight text-[var(--foreground)]">{identity.displayName}</h1>
          <p className="mt-1 text-[14px] text-[var(--text-soft)]">
            {identity.shirtNumber != null ? `#${identity.shirtNumber} · ` : ""}
            {identity.currentPrimaryPosition ?? "No position set"}
          </p>
          {secondaryLine ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{secondaryLine}</p> : null}
          <p className={`mt-2 text-[12px] font-medium ${AVAILABILITY_TONE_CLASS[identity.availabilityTone]}`}>
            {identity.availabilityLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
