import Link from "next/link";
import { db } from "@/lib/db";
import { SelectionStatus } from "@/generated/prisma/client";
import { formatMatchVenue } from "@/lib/match-utils";
import { formatDate } from "@/lib/date-utils";
import { formatGameFormat } from "@/lib/formations";

const PITCH_POSITIONS = [
  { slot: "GK", label: "GK" },
  { slot: "RB", label: "RB" },
  { slot: "CB1", label: "CB" },
  { slot: "CB2", label: "CB" },
  { slot: "LB", label: "LB" },
  { slot: "RM", label: "RM" },
  { slot: "CM1", label: "CM" },
  { slot: "CM2", label: "CM" },
  { slot: "LM", label: "LM" },
  { slot: "RW", label: "RW" },
  { slot: "ST", label: "ST" },
  { slot: "LW", label: "LW" },
];

const POSITION_FIT = ["primary", "secondary", "tertiary", "fallback"] as const;

function getPositionFit(playerPositions: { primary: string | null; secondary: string | null; tertiary: string | null }, slotLabel: string): "primary" | "secondary" | "tertiary" | "fallback" | null {
  const norm = (s: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const slot = norm(slotLabel);
  const pri = norm(playerPositions.primary);
  const sec = norm(playerPositions.secondary);
  const ter = norm(playerPositions.tertiary);
  if (pri && slot === pri) return "primary";
  if (sec && slot === sec) return "secondary";
  if (ter && slot === ter) return "tertiary";
  return slot ? "fallback" : null;
}

function fitBadge(fit: string | null) {
  if (fit === "primary") return "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]";
  if (fit === "secondary") return "border-[rgba(106,153,219,0.3)] bg-[rgba(106,153,219,0.12)] text-[#8bb8f0]";
  if (fit === "tertiary") return "border-[rgba(208,176,127,0.3)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]";
  return "border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] text-[#f0cbc5]";
}

export default async function TacticsBoardPage() {
  const matches = await db.match.findMany({
    where: {},
    include: { team: { select: { id: true, name: true } } },
    orderBy: [{ startsAt: "asc" }],
  });

  const matchOptions = matches.map((m) => ({
    id: m.id,
    label: `${m.team.name} vs. ${m.opponent} · ${formatDate(m.startsAt)} · ${formatGameFormat(m.gameFormat)}`,
  }));

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Tactics Board
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              Pitch layout
            </span>
          </div>

          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              See the squad as a football shape.
            </h1>
            <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
              Select a match to view the selected squad on a pitch layout. Position fit is scored as primary, secondary, tertiary, or fallback.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href="/matches"
              >
                Open Round Board
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Match Selection
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Choose a match to see the pitch view</h2>
        </div>

        {matchOptions.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchOptions.map((option) => (
              <Link
                key={option.id}
                className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]"
                href={`/tactics/${option.id}`}
              >
                <p className="text-sm font-semibold text-zinc-100">{option.label}</p>
                <p className="mt-1 text-sm app-copy-soft">Open pitch view</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
            No matches exist yet. Create matches first to view the Tactics Board.
          </div>
        )}
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Position Fit Legend
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {POSITION_FIT.map((fit) => (
            <div key={fit} className={`rounded-2xl border px-4 py-3 ${fitBadge(fit)}`}>
              <p className="text-sm font-semibold capitalize">{fit}</p>
              <p className="mt-1 text-xs opacity-80">
                {fit === "primary" && "Player's primary position"}
                {fit === "secondary" && "Player's secondary position"}
                {fit === "tertiary" && "Player's tertiary position"}
                {fit === "fallback" && "Not a natural position for this player"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}