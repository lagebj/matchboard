import Link from "next/link";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatSelectionRole } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";

export const dynamic = "force-dynamic";

type RotationRow = {
  playerId: string;
  playerName: string;
  teamName: string;
  cells: RotationCell[];
};

type RotationCell = {
  matchId: string;
  opponent: string;
  teamName: string;
  weekLabel: string;
  role: SelectionRole | null;
  status: SelectionStatus | null;
};

function roleTone(role: SelectionRole | null, status: SelectionStatus | null): string {
  if (!role || !status) return "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)]";
  if (role === "CORE") return "bg-[rgba(140,167,146,0.14)] border-[rgba(140,167,146,0.28)]";
  if (role === "SUPPORT") return "bg-[rgba(106,153,219,0.14)] border-[rgba(106,153,219,0.28)]";
  if (role === "BACKFILL") return "bg-[rgba(208,176,127,0.14)] border-[rgba(208,176,127,0.28)]";
  if (role === "DEVELOPMENT") return "bg-[rgba(178,140,219,0.14)] border-[rgba(178,140,219,0.28)]";
  if (role === "CONFIDENCE_REBUILD") return "bg-[rgba(106,153,219,0.1)] border-[rgba(106,153,219,0.2)]";
  if (role === "CORE_MATCH_DROP") return "bg-[rgba(185,128,119,0.14)] border-[rgba(185,128,119,0.28)]";
  if (role === "REDUCED_MATCH_LOAD_DROP") return "bg-[rgba(185,128,119,0.1)] border-[rgba(185,128,119,0.2)]";
  if (role === "MANUAL_OVERRIDE") return "bg-[rgba(208,176,127,0.1)] border-[rgba(208,176,127,0.2)]";
  return "bg-[rgba(255,255,255,0.04)] border app-hairline";
}

function roleMarker(role: SelectionRole | null): string {
  if (!role) return "—";
  return formatSelectionRole(role).charAt(0).toUpperCase();
}

export default async function RotationPage() {
  const [players, selections, matches] = await Promise.all([
    db.player.findMany({
      where: { active: true, removedAt: null },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { firstName: "asc" }, { lastName: "asc" }],
    }),
    db.selection.findMany({
      where: { status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] } },
      include: {
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { id: true, name: true } } } },
        player: { select: { id: true, firstName: true, lastName: true, coreTeam: { select: { id: true, name: true } } } },
      },
      orderBy: [{ match: { startsAt: "asc" } }],
    }),
    db.match.findMany({
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ startsAt: "asc" }],
    }),
  ]);

  const matchColumns = [...new Map(matches.map((m) => [m.id, m])).values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  const latestByPlayerMatch = new Map<string, typeof selections[number]>();
  for (const sel of selections) {
    const key = `${sel.player.id}-${sel.match.id}`;
    if (!latestByPlayerMatch.has(key)) {
      latestByPlayerMatch.set(key, sel);
    }
  }

  const rotationRows: RotationRow[] = players.map((player) => {
    const cells: RotationCell[] = matchColumns.map((match) => {
      const sel = latestByPlayerMatch.get(`${player.id}-${match.id}`);
      return {
        matchId: match.id,
        opponent: match.opponent,
        teamName: match.team.name,
        weekLabel: formatIsoWeekLabel(match.startsAt),
        role: sel?.role ?? null,
        status: sel?.status ?? null,
      };
    });

    return {
      playerId: player.id,
      playerName: formatPlayerName(player),
      teamName: player.coreTeam.name,
      cells,
    };
  });

  const teamsInResults = [...new Set(rotationRows.map((r) => r.teamName))].sort();

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
            Rotation
          </span>
          <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
            Player movement across rounds
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
          Rotation Graph
        </h1>
        <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
          Each row is a player. Each column is a match. Role markers reveal support burden, development exposure, drops, and drift over time.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="inline-flex h-11 items-center rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-5 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            href="/planner"
          >
            Open Planner Matrix
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-5 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
            href="/matches"
          >
            Open Round Board
          </Link>
        </div>
      </section>

      <section className="app-panel rounded-[1.75rem] p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Role Legend
          </p>
        </div>
        <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
          {([
            { role: "CORE", label: "Core", abbr: "C" },
            { role: "SUPPORT", label: "Support", abbr: "S" },
            { role: "BACKFILL", label: "Backfill", abbr: "B" },
            { role: "DEVELOPMENT", label: "Development", abbr: "D" },
            { role: "CONFIDENCE_REBUILD", label: "Confidence rebuild", abbr: "CR" },
            { role: "CORE_MATCH_DROP", label: "Core drop", abbr: "CD" },
            { role: "REDUCED_MATCH_LOAD_DROP", label: "Reduced load drop", abbr: "RL" },
          ] as const).map((item) => (
            <div key={item.role} className={`rounded-xl border p-3 ${roleTone(item.role as SelectionRole, SelectionStatus.FINALIZED)}`}>
              <p className="text-xs font-semibold text-zinc-100">{item.abbr}</p>
              <p className="mt-1 text-[11px] app-copy-muted">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {teamsInResults.length > 0 && matchColumns.length > 0 ? (
        <section className="app-panel rounded-[1.75rem] p-6 overflow-x-auto">
          {teamsInResults.map((teamName) => {
            const teamRows = rotationRows.filter((r) => r.teamName === teamName);
            const teamMatchCols = matchColumns.filter((m) => m.team.name === teamName);
            const uniqueWeeks = [...new Set(teamMatchCols.map((m) => formatIsoWeekLabel(m.startsAt)))];

            return (
              <div key={teamName} className="mb-8 last:mb-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)] mb-3">
                  {teamName} · rotation across {uniqueWeeks.length} week{uniqueWeeks.length === 1 ? "" : "s"}
                </p>

                {teamMatchCols.length > 0 ? (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 bg-[var(--bg-primary)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] app-copy-muted border-b app-hairline">
                          Player
                        </th>
                        {teamMatchCols.map((match) => (
                          <th key={match.id} className="px-2 py-2 text-center text-[10px] uppercase tracking-[0.12em] app-copy-muted border-b app-hairline min-w-[3.5rem]">
                            {match.opponent}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamRows.map((row) => (
                        <tr key={row.playerId} className="border-b app-hairline">
                          <td className="sticky left-0 z-10 bg-[var(--bg-primary)] px-3 py-2 text-sm font-medium text-zinc-100 whitespace-nowrap">
                            <Link className="hover:text-[var(--accent-strong)]" href={`/players/${row.playerId}`}>
                              {row.playerName}
                            </Link>
                          </td>
                          {teamMatchCols.map((match) => {
                            const cell = row.cells.find((c) => c.matchId === match.id);
                            const role = cell?.role ?? null;
                            const status = cell?.status ?? null;
                            const isDraft = status === SelectionStatus.DRAFT;
                            return (
                              <td key={match.id} className="px-1 py-2 text-center">
                                <Link href={`/selection/${match.id}`}>
                                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[10px] font-bold ${roleTone(role, status)} ${isDraft ? "opacity-70" : ""}`}>
                                    {roleMarker(role)}
                                  </span>
                                </Link>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm app-copy-soft">No matches for this team yet.</p>
                )}
              </div>
            );
          })}
        </section>
      ) : (
        <section className="app-panel rounded-[1.75rem] p-6">
          <p className="text-sm app-copy-soft">No match data yet. Create matches and generate selections to see the rotation graph.</p>
        </section>
      )}
    </main>
  );
}