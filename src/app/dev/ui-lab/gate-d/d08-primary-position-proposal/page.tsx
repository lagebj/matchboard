import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";

/**
 * Gate D W1 extension — D08 index. ADR-0160's decided primary-position approval policy (§1, §6),
 * demonstrated as a directional review surface — see `shared/position-proposal-review.tsx` for
 * the disclosure. Both states target a 14-role profile code, never a sided/central tactical code,
 * as the proposed primary.
 */
const STATES = [
  { href: "/dev/ui-lab/gate-d/d08-primary-position-proposal/strong-evidence", id: "STRONG", title: "Strong, unambiguous evidence" },
  { href: "/dev/ui-lab/gate-d/d08-primary-position-proposal/conflicting-note", id: "CONFLICT", title: "Conflicting coach note" },
];

export default function D08IndexPage() {
  return (
    <div className="touchline mx-auto max-w-[560px] px-6 py-10">
      <Link href="/dev/ui-lab/gate-d" className="text-[12px] text-[var(--text-muted)] hover:underline">
        &larr; Gate D
      </Link>
      <h1 className="mt-2 text-[20px] font-[650] text-[var(--foreground)]">D08 — Primary position proposal</h1>
      <div className="mt-6">
        <AppearanceControl />
      </div>
      <ul className="mt-8 flex flex-col gap-1.5">
        {STATES.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 px-3 py-2.5 text-[13px] text-[var(--foreground)] hover:border-[var(--accent)]"
            >
              <span>{s.title}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{s.id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
