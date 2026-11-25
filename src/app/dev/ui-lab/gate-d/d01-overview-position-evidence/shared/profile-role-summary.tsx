import { collapseTacticalToProfile } from "@/app/dev/ui-lab/gate-a/shared/profile-position-model";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import type { CanonicalTacticalPosition } from "@/domain/positions/roles";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";

/**
 * Directional UI Lab presentation for D01's actual acceptance question (ADR-0160 §6): a 14-role
 * player-profile summary, separate from the 24-code exact tactical vocabulary. The production
 * mount above (`PlayerPositionProfile`/`PlayerPositionMapWidget`) is real and unmodified — it
 * demonstrates today's current production behavior, which is one unified 24-code vocabulary with
 * no profile tier at all. This component is additional: it demonstrates the *approved* 14-role
 * profile experience ADR-0160 decided on, which has not shipped to production yet (confirmed: no
 * `collapseTacticalToProfile` caller exists outside `src/app/dev/ui-lab/gate-a/**`). It reuses the
 * one real mapping authority in this repo (`collapseTacticalToProfile`, Gate A's own directional
 * study) rather than inventing a second mapping.
 */
export function ProfileRoleSummary({
  declaredTactical,
  effectivePositions,
}: {
  declaredTactical: CanonicalTacticalPosition;
  effectivePositions: TouchlinePositionMapEntry[];
}) {
  const declaredProfile = collapseTacticalToProfile(declaredTactical);
  const top = effectivePositions.find((e) => e.rank === 1) ?? effectivePositions[0];
  const derivedProfile = collapseTacticalToProfile(top.positionCode as CanonicalTacticalPosition);
  const agree = declaredProfile === derivedProfile;

  return (
    <Surface>
      <div className="p-4">
        <SectionHeader
          title="Player-profile role (directional)"
          description="14-role profile vocabulary, ADR-0160 §6 — approved direction, not yet in production."
        />
        <div className="mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span>
            Declared: <strong className="font-mono">{declaredProfile}</strong>
          </span>
          <span>
            Evidence-derived: <strong className="font-mono">{derivedProfile}</strong>
            <span className="ml-2 text-xs text-[var(--text-muted)]">
              {top.supportBand} · confidence {top.confidence}
            </span>
          </span>
        </div>
        {agree ? (
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">
            Declared and evidence-derived profile roles agree.
          </p>
        ) : (
          <p className="mt-2 rounded-md border border-[var(--warning)] px-3 py-2 text-[12px] text-[var(--warning)]">
            Declared profile role ({declaredProfile}) and the evidence-derived role ({derivedProfile})
            differ. This is an emerging suggestion based on recorded evidence — no automatic
            primary-position mutation occurs. The declared profile role above is still the real,
            current declaration; the evidence-derived role is never rendered as if it had already
            replaced it.
          </p>
        )}
        <details className="mt-3 text-[12px] text-[var(--text-muted)]">
          <summary className="cursor-pointer select-none">Exact tactical evidence</summary>
          <ul className="mt-2 space-y-1">
            {effectivePositions.map((e) => (
              <li key={e.positionCode} className="flex items-center justify-between">
                <span className="font-mono">{e.positionCode}</span>
                <span>
                  rank {e.rank ?? "—"} · {e.supportBand} · {e.confidence}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Surface>
  );
}
