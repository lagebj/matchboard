import Link from "next/link";
import type {
  Match,
  MatchSelection,
  MatchSelectionPlayer,
  Player,
  SelectionRole,
  SelectionStatus,
  Team,
} from "@/generated/prisma/client";
import { resetSelectionsAction } from "@/app/matches/actions";
import { saveManualSelectionAction } from "@/app/selection/[matchId]/actions";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";
import { formatAvailabilityStatus, formatPlayerName, getPlayerPositionSummary } from "@/lib/player-metrics";
import type { SelectionMovementPlayer } from "@/lib/selection/get-selection-movement";

type PlayerGroup = {
  players: Array<
    Player & {
      coreTeam: Pick<Team, "id" | "name">;
    }
  >;
  team: Pick<Team, "id" | "name">;
};

type LatestSelection = MatchSelection & {
  players: Array<
    MatchSelectionPlayer & {
      player: Pick<Player, "firstName" | "id" | "lastName">;
    }
  >;
};

type WeekOverviewMatch = Match & {
  latestSelection: LatestSelection | null;
  movementPlayers: SelectionMovementPlayer[];
  targetTeam: Pick<Team, "id" | "minSupportPlayers" | "name"> & {
    developmentTargetRelationships: Array<{
      sourceTeam: Pick<Team, "id" | "name">;
    }>;
    supportTargetRelationships: Array<{
      sourceTeam: Pick<Team, "id" | "name">;
    }>;
  };
};

type WeekOverviewBoardProps = {
  groupedPlayers: PlayerGroup[];
  matches: WeekOverviewMatch[];
  returnPath: string;
  weekLabel: string;
};

const roleLabels: Record<SelectionRole, string> = {
  CORE: "Core",
  DEVELOPMENT: "Development",
  FLOAT: "Float",
  MANUAL: "Manual",
  SUPPORT: "Support",
};

function formatSelectionState(status: SelectionStatus | null): string {
  if (status === "FINALIZED") {
    return "Finalized";
  }

  if (status === "DRAFT") {
    return "Draft";
  }

  return "Not started";
}

function getSelectionStateClassName(status: SelectionStatus | null): string {
  if (status === "FINALIZED") {
    return "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]";
  }

  if (status === "DRAFT") {
    return "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]";
  }

  return "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]";
}

function getActiveSavedPlayers(latestSelection: LatestSelection | null) {
  return latestSelection?.players.filter((player) => !player.wasManuallyRemoved) ?? [];
}

function getSelectedRoleByPlayerId(latestSelection: LatestSelection | null): Record<string, SelectionRole> {
  return Object.fromEntries(
    getActiveSavedPlayers(latestSelection).map((player) => [player.playerId, player.roleType]),
  );
}

function getSuggestedRole(
  player: Player & { coreTeam: Pick<Team, "id" | "name"> },
  developmentSourceTeamIds: string[],
  supportSourceTeamIds: string[],
  targetTeamId: string,
): SelectionRole {
  if (player.coreTeamId === targetTeamId) {
    return "CORE";
  }

  if (!player.isFloating) {
    return "MANUAL";
  }

  if (supportSourceTeamIds.includes(player.coreTeamId)) {
    return "SUPPORT";
  }

  if (developmentSourceTeamIds.includes(player.coreTeamId)) {
    return "DEVELOPMENT";
  }

  return "FLOAT";
}

export function WeekOverviewBoard({
  groupedPlayers,
  matches,
  returnPath,
  weekLabel,
}: WeekOverviewBoardProps) {
  return (
    <section className="app-panel rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Week Board
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{weekLabel}</h2>
          <p className="mt-2 text-sm app-copy-soft">
            Pick across the whole week here. Open a full workspace only when one match needs deeper detail.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
          href="/matches"
        >
          Back to queue
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex min-w-max items-start gap-4 pb-2">
          {matches.map((match) => {
            const saveAction = saveManualSelectionAction.bind(null, match.id);
            const latestSelectionStatus = match.latestSelection?.status ?? null;
            const latestSelectionIsFinalized = latestSelectionStatus === "FINALIZED";
            const selectedRoleByPlayerId = getSelectedRoleByPlayerId(match.latestSelection);
            const selectedCount = Object.keys(selectedRoleByPlayerId).length;
            const supportSourceTeamIds = match.targetTeam.supportTargetRelationships.map(
              (relationship) => relationship.sourceTeam.id,
            );
            const developmentSourceTeamIds = match.targetTeam.developmentTargetRelationships.map(
              (relationship) => relationship.sourceTeam.id,
            );
            const activeSavedPlayers = getActiveSavedPlayers(match.latestSelection);

            return (
              <section
                key={match.id}
                className="w-[24rem] shrink-0 rounded-[1.5rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-zinc-50">
                      {match.targetTeam.name} vs. {match.opponent}
                    </p>
                    <p className="mt-1 text-sm app-copy-soft">
                      {formatDate(match.startsAt)} · {formatMatchVenue(match.homeOrAway)}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] app-copy-muted">
                      {match.availableForDevelopmentSlot ? "Development open" : "Development closed"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getSelectionStateClassName(latestSelectionStatus)}`}
                  >
                    {formatSelectionState(latestSelectionStatus)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                    href={`/selection/${match.id}`}
                  >
                    Open workspace
                  </Link>
                  <form action={resetSelectionsAction}>
                    <input name="resetScope" type="hidden" value="match" />
                    <input name="returnPath" type="hidden" value={returnPath} />
                    <input name="selectedMatchIds" type="hidden" value={match.id} />
                    <button
                      className="h-9 rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-3 text-xs font-medium text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.14)] hover:text-white"
                      type="submit"
                    >
                      Reset match
                    </button>
                  </form>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                      Selected
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-50">
                      {selectedCount} / {match.squadSize}
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                      Movers
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-50">
                      {match.movementPlayers.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                      Support
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-50">
                      {match.targetTeam.minSupportPlayers}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                    Floating movement
                  </p>
                  {match.movementPlayers.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {match.movementPlayers.map((player) => (
                        <span
                          key={player.playerId}
                          className="rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs text-zinc-100"
                        >
                          {player.playerName}
                          <span className="ml-2 app-copy-muted">
                            {player.sourceTeamName} to {player.targetTeamName}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm app-copy-soft">No saved floating movement in this match.</p>
                  )}
                </div>

                {latestSelectionIsFinalized ? (
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="rounded-2xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                        Locked squad
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        {activeSavedPlayers.length > 0 ? (
                          activeSavedPlayers.map((player) => (
                            <div
                              key={player.id}
                              className="rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-3"
                            >
                              <p className="text-sm font-medium text-zinc-100">
                                {formatPlayerName(player.player)}
                              </p>
                              <p className="mt-1 text-sm app-copy-soft">
                                {formatSelectionRole(player.roleType)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm app-copy-soft">No locked players saved for this match.</p>
                        )}
                      </div>
                    </div>
                    <Link
                      className="inline-flex h-10 items-center justify-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                      href={`/selection/${match.id}`}
                    >
                      Open workspace
                    </Link>
                  </div>
                ) : (
                  <form action={saveAction} className="mt-4 flex flex-col gap-4">
                    <input name="returnPath" type="hidden" value={returnPath} />

                    {match.latestSelection ? (
                      <input name="baselineSelectionId" type="hidden" value={match.latestSelection.id} />
                    ) : null}

                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-muted">
                        Note
                      </span>
                      <textarea
                        className="min-h-20 rounded-2xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
                        defaultValue={match.latestSelection?.overrideNotes ?? ""}
                        name="overrideNotes"
                        placeholder="Short note if you are forcing this one."
                      />
                    </label>

                    <div className="max-h-[34rem] overflow-y-auto rounded-2xl border app-hairline bg-[rgba(0,0,0,0.12)]">
                      {groupedPlayers.map((group) => (
                        <section key={group.team.id} className="border-b app-hairline last:border-b-0">
                          <header className="bg-[rgba(255,255,255,0.03)] px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] app-copy-soft">
                              {group.team.name}
                            </p>
                          </header>

                          <div className="divide-y app-hairline">
                            {group.players.map((player) => {
                              const selectedRole =
                                selectedRoleByPlayerId[player.id] ??
                                getSuggestedRole(
                                  player,
                                  developmentSourceTeamIds,
                                  supportSourceTeamIds,
                                  match.targetTeam.id,
                                );

                              return (
                                <label
                                  key={player.id}
                                  className="grid gap-3 px-3 py-3"
                                >
                                  <div className="flex items-start gap-3">
                                    <input
                                      defaultChecked={Boolean(selectedRoleByPlayerId[player.id])}
                                      name="selectedPlayerIds"
                                      type="checkbox"
                                      value={player.id}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-zinc-50">
                                        {formatPlayerName(player)}
                                      </p>
                                      <p className="mt-1 text-sm app-copy-soft">
                                        {getPlayerPositionSummary(player)} ·{" "}
                                        {formatAvailabilityStatus(player.currentAvailability)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                                    <p className="text-xs uppercase tracking-[0.18em] app-copy-muted">
                                      {player.coreTeam.name}
                                    </p>
                                    <select
                                      className="h-9 rounded-xl border app-hairline bg-[rgba(8,10,14,0.32)] px-3 text-sm text-zinc-100"
                                      defaultValue={selectedRole}
                                      name={`roleType:${player.id}`}
                                    >
                                      {Object.entries(roleLabels).map(([roleType, label]) => (
                                        <option key={roleType} value={roleType}>
                                          {label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        name="intent"
                        type="submit"
                        value="DRAFT"
                      >
                        Save draft
                      </button>
                      <button
                        className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.07)] hover:text-zinc-50"
                        name="intent"
                        type="submit"
                        value="FINALIZED"
                      >
                        Finalize
                      </button>
                      <Link
                        className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                        href={`/selection/${match.id}`}
                      >
                        Open workspace
                      </Link>
                    </div>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
