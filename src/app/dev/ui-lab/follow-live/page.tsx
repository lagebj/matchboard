import { MatchScoreHeader, StatusText } from "@/components/touchline";
import { UiLabShell } from "../ui-lab-shells";
import { followLiveMatch, followLiveOnField, followLiveEvents } from "../fixtures";

/**
 * Golden: follow-live-mobile (390×844).
 * Read-only scoreboard grammar — canonical score / clock / on-field state, no
 * mutating chrome. The score header is presentation only; it never forks live
 * truth.
 */
export default function UiLabFollowLivePage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[560px]">
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Follow live
          </p>
          <h1 className="mt-0.5 text-[24px] font-[650] leading-tight text-[var(--foreground)]">
            Rød vs Graabein United
          </h1>
        </div>
        <StatusText tone="live" dot strong className="pt-1">
          LIVE
        </StatusText>
      </div>

      <div className="mt-4">
        <MatchScoreHeader presentation={followLiveMatch} framed />
      </div>

      <section className="mt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[18px] font-[620] text-[var(--foreground)]">On field</h2>
          <span className="text-[12px] text-[var(--text-muted)]">
            {followLiveOnField.length} players
          </span>
        </div>
        <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {followLiveOnField.map((p) => (
            <li key={p.name} className="flex items-center gap-3 py-2">
              <span className="w-8 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {p.code}
              </span>
              <span className="text-[15px] font-[600] text-[var(--foreground)]">{p.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5">
        <h2 className="text-[18px] font-[620] text-[var(--foreground)]">Match events</h2>
        <ul className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {followLiveEvents.map((e, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-[14px]">
              <span className="w-12 shrink-0 tabular-nums text-[12px] text-[var(--text-muted)]">
                {e.time}
              </span>
              <span className="w-10 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                {e.tag}
              </span>
              <span className="text-[var(--text-soft)]">{e.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </UiLabShell>
  );
}
