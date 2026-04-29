import Link from "next/link";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekKey } from "@/lib/date-utils";
import { formatSelectionRole } from "@/lib/match-utils";
import { formatAvailabilityStatus } from "@/lib/player-metrics";

function roleMarker(role: SelectionRole | null, status: SelectionStatus | null): { label: string; tone: string } | null {
  if (status === SelectionStatus.FINALIZED) {
    if (role === SelectionRole.CORE) return { label: "Core", tone: "border-[rgba(140,167,146,0.3)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]" };
    if (role === SelectionRole.SUPPORT) return { label: "Support", tone: "border-[rgba(106,153,219,0.3)] bg-[rgba(106,153,219,0.12)] text-[#8bb8f0]" };
    if (role === SelectionRole.DEVELOPMENT) return { label: "Dev", tone: "border-[rgba(208,176,127,0.3)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]" };
    if (role === SelectionRole.BACKFILL) return { label: "Backfill", tone: "border-[rgba(219,165,106,0.3)] bg-[rgba(219,165,219,0.12)] text-[#dba56a]" };
    if (role === SelectionRole.CONFIDENCE_REBUILD) return { label: "Rebuild", tone: "border-[rgba(178,140,219,0.3)] bg-[rgba(178,140,219,0.12)] text-[#b28cdb]" };
    if (role === SelectionRole.CORE_MATCH_DROP) return { label: "Drop", tone: "border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] text-[#f0cbc5]" };
    if (role === SelectionRole.REDUCED_MATCH_LOAD_DROP) return { label: "RML Drop", tone: "border-[rgba(185,128,119,0.36)] bg-[rgba(185,128,119,0.14)] text-[#f0cbc5]" };
    if (role === SelectionRole.MANUAL_OVERRIDE) return { label: "Override", tone: "border-[rgba(208,176,127,0.3)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]" };
  }
  if (status === SelectionStatus.DRAFT) {
    return { label: "Draft", tone: "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.08)] text-[var(--warning)]" };
  }
  return null;
}

export default async function SquadPlannerPage() {
  const [players, selections, matches] = await Promise.all([
    db.player.findMany({
      where: { removedAt: null },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }, { lastName: "asc" }],
    }),
    db.selection.findMany({
      where: { status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] } },
      include: {
        player: { select: { id: true } },
        match: { select: { id: true, startsAt: true } },
      },
      orderBy: [{ match: { startsAt: "asc" } }],
    }),
    db.match.findMany({
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ startsAt: "asc" }],
    }),
  ]);

  const activePlayers = players.filter((p) => p.active);
  const weekKeys = [...new Set(matches.map((m) => formatIsoWeekKey(m.startsAt)))].slice(0, 6);

  const latestByMatchPlayer = new Map<string, (typeof selections)[number]>();
  for (const s of selections) {
    const key = `${s.matchId}:${s.player.id}`;
    if (!latestByMatchPlayer.has(key)) {
      latestByMatchPlayer.set(key, s);
    }
  }

  const playerFlags = new Map<string, string[]>();
  for (const p of activePlayers) {
    const flags: string[] = [];
    if (p.nonRotatable) flags.push("Non-rotatable");
    if (p.reducedMatchLoadAllowed) flags.push("Reduced load");
    if (p.supportNoShowCount > 0) flags.push(`${p.supportNoShowCount} no-show(s)`);
    if (p.currentAvailability !== "AVAILABLE") flags.push(formatAvailabilityStatus(p.currentAvailability));
    playerFlags.set(p.id, flags);
  }

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              Squad Planner
            </span>
            <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
              Players × Rounds
            </span>
          </div>

          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
              See who carries the load.
            </h1>
            <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
              Each row is a player. Each column is a match round. Cells show selection role or availability state. Repeated patterns surface here.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                href="/matches"
              >
                Open Round Board
              </Link>
              <Link
                className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                href="/players"
              >
                Open Players
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6 overflow-x-auto">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Rotation Matrix
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Player usage across {weekKeys.length} week{weekKeys.length === 1 ? "" : "s"}</h2>
        </div>

        {weekKeys.length > 0 && activePlayers.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b app-hairline">
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Player</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Team</th>
                  <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Flags</th>
                  {weekKeys.map((week) => (
                    <th key={week} className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted whitespace-nowrap">
                      {week}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePlayers.map((player) => {
                  const flags = playerFlags.get(player.id) ?? [];
                  return (
                    <tr key={player.id} className="border-b app-hairline hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="px-3 py-3">
                        <Link className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]" href={`/players/${player.id}`}>
                          {player.firstName} {player.lastName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-sm app-copy-soft">{player.coreTeam.name}</td>
                      <td className="px-3 py-3">
                        {flags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {flags.map((f) => (
                              <span key={f} className="rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] app-copy-muted">
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="app-copy-muted text-xs">—</span>
                        )}
                      </td>
                      {weekKeys.map((weekKey) => {
                        const weekMatches = matches.filter((m) => formatIsoWeekKey(m.startsAt) === weekKey);
                        return weekMatches.map((m) => {
                          const sel = latestByMatchPlayer.get(`${m.id}:${player.id}`);
                          const marker = sel ? roleMarker(sel.role, sel.status) : null;
                          if (player.currentAvailability !== "AVAILABLE" && !sel) {
                            return (
                              <td key={`${player.id}-${m.id}`} className="px-1 py-2 text-center">
                                <span className="rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#f0cbc5]">
                                  {formatAvailabilityStatus(player.currentAvailability)}
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={`${player.id}-${m.id}`} className="px-1 py-2 text-center">
                              {marker ? (
                                <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${marker.tone}`}>
                                  {marker.label}
                                </span>
                              ) : (
                                <span className="app-copy-muted text-xs">—</span>
                              )}
                            </td>
                          );
                        });
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
            {activePlayers.length === 0
              ? "No active players in the registry yet."
              : "No matches exist yet. Create matches to start seeing rotation patterns."}
          </div>
        )}
      </section>
    </main>
  );
}