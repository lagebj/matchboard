import Link from "next/link";
import { db } from "@/lib/db";
import { formatAvailabilityStatus, formatPlayerName } from "@/lib/player-metrics";

export const dynamic = "force-dynamic";

type AvailabilityGroup = {
  status: string;
  label: string;
  tone: string;
  players: Array<{
    id: string;
    name: string;
    coreTeamName: string;
    supportSuitability: string;
    isSupportCandidate: boolean;
  }>;
};

export default async function AvailabilityPage() {
  const [players, rotationPaths] = await Promise.all([
    db.player.findMany({
      where: { removedAt: null },
      include: { coreTeam: { select: { id: true, name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.rotationPath.findMany({
      where: { active: true },
      include: {
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
      },
    }),
  ]);

  const supportSourceTeamIds = new Set(
    rotationPaths
      .filter((p) => p.role === "SUPPORT")
      .map((p) => p.fromTeamId),
  );

  const groups: AvailabilityGroup[] = [
    {
      status: "AVAILABLE",
      label: "Confirmed available",
      tone: "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.08)]",
      players: [],
    },
    {
      status: "TENTATIVE",
      label: "Tentative",
      tone: "border-[rgba(208,176,127,0.28)] bg-[rgba(208,176,127,0.08)]",
      players: [],
    },
    {
      status: "UNKNOWN",
      label: "Unknown",
      tone: "border-[rgba(202,209,219,0.18)] bg-[rgba(255,255,255,0.03)]",
      players: [],
    },
    {
      status: "INJURED",
      label: "Unavailable",
      tone: "border-[rgba(185,128,119,0.28)] bg-[rgba(185,128,119,0.08)]",
      players: [],
    },
    {
      status: "SICK",
      label: "Unavailable",
      tone: "border-[rgba(185,128,119,0.28)] bg-[rgba(185,128,119,0.08)]",
      players: [],
    },
    {
      status: "AWAY",
      label: "Unavailable",
      tone: "border-[rgba(185,128,119,0.28)] bg-[rgba(185,128,119,0.08)]",
      players: [],
    },
  ];

  for (const player of players) {
    const group = groups.find((g) => g.status === player.currentAvailability);
    const isSupportCandidate = supportSourceTeamIds.has(player.coreTeamId);
    if (group) {
      group.players.push({
        id: player.id,
        name: formatPlayerName(player),
        coreTeamName: player.coreTeam.name,
        supportSuitability: player.supportSuitability,
        isSupportCandidate,
      });
    }
  }

  const confirmedGroup = groups.find((g) => g.status === "AVAILABLE")!;
  const tentativeGroup = groups.find((g) => g.status === "TENTATIVE")!;
  const unknownGroup = groups.find((g) => g.status === "UNKNOWN")!;
  const unavailableGroups = groups.filter(
    (g) => g.status !== "AVAILABLE" && g.status !== "TENTATIVE" && g.status !== "UNKNOWN",
  );
  const unavailableCount = unavailableGroups.reduce((sum, g) => sum + g.players.length, 0);

  const criticalUnknowns = unknownGroup.players.filter((p) => p.isSupportCandidate);

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <section className="app-panel-raised rounded-[2rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(140,167,146,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
            Availability
          </span>
          <span className="rounded-full border app-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] app-copy-soft">
            Command Center
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-5xl">
          Who is available this week?
        </h1>
        <p className="mt-4 max-w-3xl text-sm app-copy-soft sm:text-base">
          Availability beats all football logic. Unknown and tentative players must not satisfy critical support unless manually confirmed.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-[1.5rem] border border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.08)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">Confirmed</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-50">{confirmedGroup.players.length}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[rgba(208,176,127,0.28)] bg-[rgba(208,176,127,0.08)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--warning)]">Tentative</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-50">{tentativeGroup.players.length}</p>
          </div>
          <div className="rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">Unknown</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-50">{unknownGroup.players.length}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[rgba(185,128,119,0.28)] bg-[rgba(185,128,119,0.08)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0cbc5]">Unavailable</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-50">{unavailableCount}</p>
          </div>
        </div>
      </section>

      {criticalUnknowns.length > 0 && (
        <section className="app-panel rounded-[1.75rem] border border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.06)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--warning)]">
            Support-Critical Unknowns
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">
            These players are support candidates but have unknown availability
          </h2>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {criticalUnknowns.map((player) => (
              <Link
                key={player.id}
                className="rounded-[1.35rem] border border-[rgba(208,176,127,0.2)] bg-[rgba(208,176,127,0.06)] px-4 py-4 hover:bg-[rgba(208,176,127,0.1)]"
                href={`/players/${player.id}`}
              >
                <p className="text-sm font-semibold text-zinc-100">{player.name}</p>
                <p className="mt-1 text-sm app-copy-soft">{player.coreTeamName} · Support candidate</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--warning)]">
                  Needs confirmation
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {[
        { group: confirmedGroup, statusLabel: "Confirmed" },
        { group: tentativeGroup, statusLabel: "Tentative" },
        { group: unknownGroup, statusLabel: "Unknown" },
      ].map(({ group, statusLabel }) => (
        <section key={group.status} className={`app-panel rounded-[1.75rem] border p-6 ${group.tone}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                {statusLabel}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">
                {group.players.length} player{group.players.length === 1 ? "" : "s"}
              </h2>
            </div>
          </div>

          {group.players.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.players.map((player) => (
                <Link
                  key={player.id}
                  className={`rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]`}
                  href={`/players/${player.id}`}
                >
                  <p className="text-sm font-semibold text-zinc-100">{player.name}</p>
                  <p className="mt-1 text-sm app-copy-soft">{player.coreTeamName}</p>
                  {player.isSupportCandidate && (
                    <span className="mt-2 inline-block rounded-full border border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--warning)]">
                      Support candidate
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm app-copy-soft">No players in this group.</p>
          )}
        </section>
      ))}

      {unavailableGroups.filter((g) => g.players.length > 0).map((group) => (
        <section key={group.status} className={`app-panel rounded-[1.75rem] border p-6 ${group.tone}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            {formatAvailabilityStatus(group.status as any)}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">
            {group.players.length} player{group.players.length === 1 ? "" : "s"}
          </h2>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.players.map((player) => (
              <Link
                key={player.id}
                className="rounded-[1.35rem] border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 hover:bg-[rgba(255,255,255,0.05)]"
                href={`/players/${player.id}`}
              >
                <p className="text-sm font-semibold text-zinc-100">{player.name}</p>
                <p className="mt-1 text-sm app-copy-soft">{player.coreTeamName}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}