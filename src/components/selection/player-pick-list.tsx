import type { Player, SelectionRole, Team } from "@/generated/prisma/client";
import { formatAvailabilityStatus, formatPlayerName, getPlayerPositionSummary } from "@/lib/player-metrics";

const roleLabels: Record<SelectionRole, string> = {
  CORE: "Core",
  DEVELOPMENT: "Development",
  FLOAT: "Float",
  MANUAL: "Manual",
  SUPPORT: "Support",
};

type PlayerGroup = {
  players: Array<
    Player & {
      coreTeam: Pick<Team, "id" | "name">;
    }
  >;
  team: Pick<Team, "id" | "name">;
};

type PlayerPickListProps = {
  developmentSourceTeamIds: string[];
  groupedPlayers: PlayerGroup[];
  selectedRoleByPlayerId: Record<string, SelectionRole>;
  supportSourceTeamIds: string[];
  targetTeamId: string;
};

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

export function PlayerPickList({
  developmentSourceTeamIds,
  groupedPlayers,
  selectedRoleByPlayerId,
  supportSourceTeamIds,
  targetTeamId,
}: PlayerPickListProps) {
  return (
    <div className="flex flex-col gap-5">
      {groupedPlayers.map((group) => (
        <section key={group.team.id} className="border border-zinc-200 bg-white">
          <header className="border-b border-zinc-200 bg-zinc-100 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
              {group.team.name}
            </h3>
          </header>

          <div className="divide-y divide-zinc-200">
            {group.players.map((player) => {
              const selectedRole =
                selectedRoleByPlayerId[player.id] ??
                getSuggestedRole(
                  player,
                  developmentSourceTeamIds,
                  supportSourceTeamIds,
                  targetTeamId,
                );

              return (
                <label
                  key={player.id}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_10rem]"
                >
                  <div className="flex items-start gap-3">
                    <input
                      defaultChecked={Boolean(selectedRoleByPlayerId[player.id])}
                      name="selectedPlayerIds"
                      type="checkbox"
                      value={player.id}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-950">{formatPlayerName(player)}</p>
                      <p className="text-sm text-zinc-600">
                        {getPlayerPositionSummary(player)} · {formatAvailabilityStatus(player.currentAvailability)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Role</span>
                    <select
                      className="h-10 border border-zinc-300 bg-white px-3 text-sm"
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

            {group.players.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">No active players in this team.</div>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
