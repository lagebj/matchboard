"use client";

type MovedPlayer = {
  playerId: string;
  playerName: string;
  sourceTeamId: string;
  sourceTeamName: string;
  targetTeamId: string;
  targetTeamName: string;
  role: string;
};

type BackfillNeed = {
  teamId: string;
  teamName: string;
  donatedPlayerCount: number;
  needsBackfill: boolean;
  backfillReceivedCount: number;
};

type CrossTeamConsequencesProps = {
  movedPlayers: MovedPlayer[];
  backfillNeeds: BackfillNeed[];
};

export function CrossTeamConsequences({
  movedPlayers,
  backfillNeeds,
}: CrossTeamConsequencesProps) {
  if (movedPlayers.length === 0 && backfillNeeds.every((b) => b.donatedPlayerCount === 0)) {
    return null;
  }

  const donationsBySourceTeam = new Map<string, { teamName: string; players: MovedPlayer[] }>();
  for (const mp of movedPlayers) {
    const existing = donationsBySourceTeam.get(mp.sourceTeamId);
    if (existing) {
      existing.players.push(mp);
    } else {
      donationsBySourceTeam.set(mp.sourceTeamId, {
        teamName: mp.sourceTeamName,
        players: [mp],
      });
    }
  }

  return (
    <section className="rounded-[1.5rem] border border-[rgba(208,176,127,0.18)] bg-[rgba(208,176,127,0.04)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--warning)]">
            Cross-team consequences
          </p>
          <p className="mt-2 text-sm app-copy-soft">
            Players moving between teams affect squad counts and backfill needs across the round.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--warning)]">
          {movedPlayers.length} mover{movedPlayers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {movedPlayers.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from(donationsBySourceTeam.entries()).map(([sourceTeamId, data]) => (
            <div
              key={sourceTeamId}
              className="rounded-xl border border-[rgba(208,176,127,0.14)] bg-[rgba(0,0,0,0.14)] px-3 py-3"
            >
              <p className="text-sm font-semibold text-zinc-100">
                {data.teamName}
                <span className="ml-2 text-xs font-normal uppercase tracking-[0.14em] app-copy-muted">
                  loses {data.players.length} player{data.players.length !== 1 ? "s" : ""}
                </span>
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {data.players.map((mp) => (
                  <div
                    key={mp.playerId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="font-medium text-zinc-100">{mp.playerName}</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] app-copy-muted">
                      &rarr;
                    </span>
                    <span className="rounded-full border border-[rgba(208,176,127,0.18)] bg-[rgba(208,176,127,0.08)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--warning)]">
                      {mp.role.toLowerCase()} for {mp.targetTeamName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {backfillNeeds.filter((b) => b.needsBackfill).length > 0 && (
        <div className="mt-3 rounded-xl border border-[rgba(185,128,119,0.18)] bg-[rgba(185,128,119,0.06)] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">
            Backfill needed
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {backfillNeeds
              .filter((b) => b.needsBackfill)
              .map((b) => (
                <p key={b.teamId} className="text-sm app-copy-soft">
                  {b.teamName} donated {b.donatedPlayerCount} player{b.donatedPlayerCount !== 1 ? "s" : ""} and received {b.backfillReceivedCount} backfill — net deficit needs attention.
                </p>
              ))}
          </div>
        </div>
      )}

      {movedPlayers.length > 0 && (
        <div className="mt-4 -mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max items-center gap-4">
            {movedPlayers.map((mp) => (
              <div
                key={mp.playerId}
                className="flex items-center gap-2 rounded-xl border app-hairline bg-[rgba(0,0,0,0.1)] px-3 py-2 text-sm"
              >
                <span className="rounded-full bg-[rgba(185,128,119,0.14)] px-2 py-0.5 text-[10px] font-medium text-[var(--danger)]">
                  {mp.sourceTeamName}
                </span>
                <span className="text-[var(--warning)]">&rarr;</span>
                <span className="font-medium text-zinc-100">{mp.playerName}</span>
                <span className="text-[var(--warning)]">&rarr;</span>
                <span className="rounded-full bg-[rgba(140,167,146,0.14)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                  {mp.targetTeamName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}