import { cn } from "@/lib/cn";
import { TouchlineButton } from "@/components/touchline";
import { PROFILE_POSITIONS, PROFILE_STORED_CANDIDATE, type ProfilePosition } from "../shared/profile-position-model";

/**
 * `ProfilePositionSelector` — A12 UI Lab candidate only. A 14-role declared-profile picker,
 * visual only, no production wiring (BLK-03: the real `PlayerEditorForm` still offers all 24
 * sided `CanonicalTacticalPosition` codes and is untouched by this candidate).
 *
 * Every selector option's visible label matches the profile vocabulary exactly — never shows a
 * 24-code sided label (`LCB`/`RCM`/etc.) next to a 14-role button, so selector and label stay
 * consistent (`20_UI_LAB_CANDIDATE_WAVES.md` A12: "verify selectors AND text labels").
 */
type Props = {
  value: ProfilePosition | null;
  onChange: (value: ProfilePosition) => void;
  className?: string;
};

export function ProfilePositionSelector({ value, onChange, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="radiogroup" aria-label="Declared profile position">
      {PROFILE_POSITIONS.map((position) => {
        const stored = PROFILE_STORED_CANDIDATE[position];
        return (
          <TouchlineButton
            key={position}
            type="button"
            role="radio"
            aria-checked={value === position}
            size="sm"
            variant={value === position ? "primary" : "secondary"}
            onClick={() => onChange(position)}
            title={stored ? `Unsided profile — nearest stored candidate ${stored}` : undefined}
          >
            {position}
          </TouchlineButton>
        );
      })}
    </div>
  );
}
