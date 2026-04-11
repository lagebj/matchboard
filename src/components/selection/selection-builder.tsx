import Link from "next/link";
import type { Match, MatchSelection, MatchSelectionPlayer, Player, SelectionRole, Team } from "@/generated/prisma/client";
import {
  acceptGeneratedSelectionAction,
  generateSuggestedSelectionAction,
  saveManualSelectionAction,
} from "@/app/selection/[matchId]/actions";
import { recalculateMatchAction } from "@/app/matches/actions";
import {
  GeneratedExcludedTable,
} from "@/components/selection/generated-excluded-table";
import {
  GeneratedSelectedTable,
} from "@/components/selection/generated-selected-table";
import { PlayerPickList } from "@/components/selection/player-pick-list";
import { SavedSelectionTable } from "@/components/selection/saved-selection-table";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";
import type { GeneratedSelection } from "@/lib/selection/types";

type PlayerGroup = {
  players: Array<
    Player & {
      coreTeam: Pick<Team, "id" | "name">;
    }
  >;
  team: Pick<Team, "id" | "name">;
};

type SelectionWithPlayers = MatchSelection & {
  players: Array<
    MatchSelectionPlayer & {
      player: Player & {
        coreTeam: Pick<Team, "id" | "name">;
      };
    }
  >;
};

type MatchWithTeam = Match & {
  targetTeam: Pick<Team, "developmentSlots" | "id" | "minSupportPlayers" | "name"> & {
    developmentTargetRelationships: Array<{
      sourceTeam: Pick<Team, "id" | "name">;
    }>;
    supportTargetRelationships: Array<{
      sourceTeam: Pick<Team, "id" | "name">;
    }>;
  };
};

type SelectionBuilderProps = {
  acceptedGenerated: boolean;
  errorMessage?: string;
  generatedSelection: GeneratedSelection | null;
  groupedPlayers: PlayerGroup[];
  latestSelection: SelectionWithPlayers | null;
  match: MatchWithTeam;
  nextMatchId: string | null;
  previousMatchId: string | null;
  recalculated: boolean;
  savedMessage?: string;
  selectionAnalysis: GeneratedSelection | null;
};

type OmittedCorePlayerRow = {
  explanation: string;
  playerId: string;
  playerName: string;
};

type EarlyWarningRow = {
  code: string;
  message: string;
  title: string;
};

function formatSavedStatus(savedMessage: string): string {
  return savedMessage === "final" ? "Final selection saved." : "Draft selection saved.";
}

function formatReasonList(reasons: string[]): string {
  return [...new Set(reasons.filter(Boolean))].join(" ");
}

function formatWarningTitle(code: string): string {
  switch (code) {
    case "support_requirement_shortfall":
    case "saved_support_requirement_shortfall":
      return "Support shortfall";
    case "development_slot_shortfall":
      return "Development shortfall";
    case "short_squad":
    case "saved_selection_incomplete":
      return "Incomplete squad";
    case "saved_selection_overfilled":
      return "Squad overfilled";
    case "locked_core_player_unselected":
    case "saved_locked_core_player_unselected":
      return "Locked core player omitted";
    case "support_backfill_priority":
      return "Support backfill";
    case "core_player_overflow":
      return "Core overflow";
    default:
      return code.replaceAll("_", " ");
  }
}

function buildSavedOmissionExplanation(
  playerId: string,
  removalExplanation: string | null | undefined,
  analysisSelection: GeneratedSelection | null,
) {
  if (removalExplanation) {
    return removalExplanation;
  }

  const analyzedExclusion = analysisSelection?.excludedPlayers.find(
    (player) => player.playerId === playerId,
  );

  if (analyzedExclusion) {
    return formatReasonList([
      analyzedExclusion.exclusionReason,
      ...analyzedExclusion.explanations.map((explanation) => explanation.summary),
    ]);
  }

  const analyzedSelection = analysisSelection?.selectedPlayers.find(
    (player) => player.playerId === playerId,
  );

  if (analyzedSelection) {
    return "Omitted from the current saved selection without a saved removal note. The current automatic analysis would include this player, so this omission comes from the saved manual selection state.";
  }

  return "Omitted from the current saved selection without a saved removal note, and the app could not map a more specific automatic omission reason for this player.";
}

function formatSelectionTrace(player: {
  wasAutoSelected: boolean;
  wasManuallyAdded?: boolean;
  wasManuallyRemoved?: boolean;
}): string {
  if (player.wasManuallyRemoved) {
    return "Manually removed";
  }

  if (player.wasAutoSelected && !player.wasManuallyAdded) {
    return "Auto-generated";
  }

  if (player.wasManuallyAdded) {
    return "Manually added";
  }

  return "Manual";
}

function getActiveSavedPlayers(latestSelection: SelectionWithPlayers | null) {
  return latestSelection?.players.filter((player) => !player.wasManuallyRemoved) ?? [];
}

function getRemovedSavedPlayers(latestSelection: SelectionWithPlayers | null) {
  return latestSelection?.players.filter((player) => player.wasManuallyRemoved) ?? [];
}

function buildSelectedRoleByPlayerId(
  latestSelection: SelectionWithPlayers | null,
  generatedSelection: GeneratedSelection | null,
): Record<string, SelectionRole> {
  const activePlayers = getActiveSavedPlayers(latestSelection);

  if (activePlayers.length > 0) {
    return Object.fromEntries(
      activePlayers.map((player) => [player.playerId, player.roleType]),
    );
  }

  if (!generatedSelection) {
    return {};
  }

  return Object.fromEntries(
    generatedSelection.selectedPlayers.map((player) => [
      player.playerId,
      (player.selectionCategory === "CORE"
        ? "CORE"
        : player.selectionCategory === "SUPPORT"
          ? "SUPPORT"
          : player.selectionCategory === "DEVELOPMENT"
            ? "DEVELOPMENT"
            : "FLOAT") as SelectionRole,
    ]),
  );
}

export function SelectionBuilder({
  acceptedGenerated,
  errorMessage,
  generatedSelection,
  groupedPlayers,
  latestSelection,
  match,
  nextMatchId,
  previousMatchId,
  recalculated,
  savedMessage,
  selectionAnalysis,
}: SelectionBuilderProps) {
  const acceptGeneratedAction = acceptGeneratedSelectionAction.bind(null, match.id);
  const generateAction = generateSuggestedSelectionAction.bind(null, match.id);
  const recalculateAction = recalculateMatchAction.bind(null, match.id);
  const saveAction = saveManualSelectionAction.bind(null, match.id);
  const selectedRoleByPlayerId = buildSelectedRoleByPlayerId(latestSelection, generatedSelection);
  const activeSavedPlayers = getActiveSavedPlayers(latestSelection);
  const removedSavedPlayers = getRemovedSavedPlayers(latestSelection);
  const activeSavedPlayerIds = new Set(activeSavedPlayers.map((player) => player.playerId));
  const removedSavedPlayerById = new Map(
    removedSavedPlayers.map((player) => [player.playerId, player]),
  );
  const activePlayerCount = groupedPlayers.reduce((total, group) => total + group.players.length, 0);
  const selectedCount = Object.keys(selectedRoleByPlayerId).length;
  const latestSelectionIsFinalized = latestSelection?.status === "FINALIZED";
  const supportSourceTeams = match.targetTeam.supportTargetRelationships.map(
    (relationship) => relationship.sourceTeam.name,
  );
  const developmentSourceTeams = match.targetTeam.developmentTargetRelationships.map(
    (relationship) => relationship.sourceTeam.name,
  );
  const savedSelectionGap = match.squadSize - activeSavedPlayers.length;
  const targetTeamPlayers =
    groupedPlayers.find((group) => group.team.id === match.targetTeamId)?.players ?? [];
  const generatedSelectedPlayerIds = new Set(
    generatedSelection?.selectedPlayers.map((player) => player.playerId) ?? [],
  );
  const generatedExcludedPlayerById = new Map(
    (generatedSelection?.excludedPlayers ?? []).map((player) => [player.playerId, player]),
  );
  const analyzedSupportShortfallWarning = selectionAnalysis?.warnings.find(
    (warning) => warning.code === "support_requirement_shortfall",
  );
  const savedSupportPlayers = activeSavedPlayers.filter((player) => player.roleType === "SUPPORT").length;
  const savedOmittedCorePlayers: OmittedCorePlayerRow[] = latestSelection
    ? targetTeamPlayers
        .filter((player) => !activeSavedPlayerIds.has(player.id))
        .map((player) => ({
          explanation: buildSavedOmissionExplanation(
            player.id,
            removedSavedPlayerById.get(player.id)?.explanation,
            selectionAnalysis,
          ),
          playerId: player.id,
          playerName: formatPlayerName(player),
        }))
        .sort((left, right) => left.playerName.localeCompare(right.playerName))
    : [];
  const generatedOmittedCorePlayers: OmittedCorePlayerRow[] = generatedSelection
    ? targetTeamPlayers
        .filter((player) => !generatedSelectedPlayerIds.has(player.id))
        .map((player) => {
          const excludedPlayer = generatedExcludedPlayerById.get(player.id);

          return {
            explanation: excludedPlayer
              ? formatReasonList([
                  excludedPlayer.exclusionReason,
                  ...excludedPlayer.explanations.map((explanation) => explanation.summary),
                ])
              : "Not selected by the current generated squad.",
            playerId: player.id,
            playerName: formatPlayerName(player),
          };
        })
        .sort((left, right) => left.playerName.localeCompare(right.playerName))
    : [];
  const savedLockedCoreWarnings = latestSelection
    ? groupedPlayers
        .flatMap((group) => group.players)
        .filter(
          (player) =>
            player.coreTeamId === match.targetTeamId &&
            player.active &&
            !player.isFloating &&
            !player.canDropCoreMatch &&
            !activeSavedPlayerIds.has(player.id),
        )
        .map((player) => ({
          code: "saved_locked_core_player_unselected",
          message: `${formatPlayerName(player)} is a locked ${match.targetTeam.name} core player and is not in the current saved selection. ${buildSavedOmissionExplanation(
            player.id,
            removedSavedPlayerById.get(player.id)?.explanation,
            selectionAnalysis,
          )}`,
        }))
    : [];
  const earlyWarnings: EarlyWarningRow[] = [
    ...(latestSelection &&
    match.targetTeam.minSupportPlayers > 0 &&
    savedSupportPlayers < match.targetTeam.minSupportPlayers
      ? [
          {
            code: "saved_support_requirement_shortfall",
            message: `${match.targetTeam.name} requires ${match.targetTeam.minSupportPlayers} support player(s), but the current saved selection only includes ${savedSupportPlayers}. Configured support teams: ${supportSourceTeams.length > 0 ? supportSourceTeams.join(", ") : "none"}.${analyzedSupportShortfallWarning ? ` Current automatic analysis: ${analyzedSupportShortfallWarning.message}` : ""}`,
            title: formatWarningTitle("saved_support_requirement_shortfall"),
          },
        ]
      : []),
    ...(generatedSelection?.warnings ?? []).map((warning) => ({
      ...warning,
      title: formatWarningTitle(warning.code),
    })),
    ...savedLockedCoreWarnings,
    ...(latestSelection && savedSelectionGap > 0
      ? [
          {
            code: "saved_selection_incomplete",
            message: `The current saved selection is still ${savedSelectionGap} player(s) short of the ${match.squadSize}-player squad size.`,
            title: formatWarningTitle("saved_selection_incomplete"),
          },
        ]
      : latestSelection && savedSelectionGap < 0
        ? [
            {
              code: "saved_selection_overfilled",
              message: `The current saved selection has ${Math.abs(savedSelectionGap)} player(s) more than the ${match.squadSize}-player squad size.`,
              title: formatWarningTitle("saved_selection_overfilled"),
            },
          ]
      : []),
  ]
    .map((warning) => ({
      ...warning,
      title: "title" in warning ? warning.title : formatWarningTitle(warning.code),
    }))
    .sort((left, right) => {
      const leftPriority = left.code.includes("support") ? 0 : 1;
      const rightPriority = right.code.includes("support") ? 0 : 1;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.title.localeCompare(right.title);
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Matchboard</p>
          <h1 className="text-3xl font-semibold tracking-tight">Selection</h1>
          <p className="text-sm leading-6 text-zinc-600">
            Manual selection for {match.targetTeam.name} on {formatDate(match.startsAt)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {previousMatchId ? (
            <Link
              className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
              href={`/selection/${previousMatchId}`}
            >
              Previous match
            </Link>
          ) : null}
          {nextMatchId ? (
            <Link
              className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
              href={`/selection/${nextMatchId}`}
            >
              Next match
            </Link>
          ) : null}
          <Link
            className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
            href="/matches"
          >
            Back to matches
          </Link>
        </div>
      </header>

      {savedMessage ? (
        <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          {formatSavedStatus(savedMessage)}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {acceptedGenerated ? (
        <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          Suggested squad saved as the current draft. You can adjust it below before finalizing.
        </div>
      ) : null}

      {recalculated ? (
        <div className="border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          Draft selection recalculated for this match.
        </div>
      ) : null}

      {earlyWarnings.length > 0 ? (
        <section className="border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-950">
            Early Warnings
          </h2>
          <div className="mt-3 flex flex-col gap-3 text-sm text-amber-950">
            {earlyWarnings.map((warning) => (
              <div key={warning.code + warning.message} className="border border-amber-200 bg-white/70 px-4 py-3">
                <p className="font-medium">{warning.title}</p>
                <p className="mt-1">{warning.message}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {savedOmittedCorePlayers.length > 0 || generatedOmittedCorePlayers.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {savedOmittedCorePlayers.length > 0 ? (
            <div className="border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-semibold">Current Saved Core Omissions</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {match.targetTeam.name} core players not currently in the saved selection.
              </p>
              <div className="mt-4 flex flex-col divide-y divide-zinc-200 border border-zinc-200">
                {savedOmittedCorePlayers.map((player) => (
                  <div key={player.playerId} className="px-4 py-3 text-sm">
                    <p className="font-medium text-zinc-950">{player.playerName}</p>
                    <p className="mt-1 text-zinc-700">{player.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {generatedOmittedCorePlayers.length > 0 ? (
            <div className="border border-zinc-200 bg-white p-5">
              <h2 className="text-base font-semibold">Suggested Core Omissions</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {match.targetTeam.name} core players the current suggestion did not pick.
              </p>
              <div className="mt-4 flex flex-col divide-y divide-zinc-200 border border-zinc-200">
                {generatedOmittedCorePlayers.map((player) => (
                  <div key={player.playerId} className="px-4 py-3 text-sm">
                    <p className="font-medium text-zinc-950">{player.playerName}</p>
                    <p className="mt-1 text-zinc-700">{player.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 border border-zinc-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Date</p>
          <p className="mt-1 text-sm text-zinc-900">{formatDate(match.startsAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Team</p>
          <p className="mt-1 text-sm text-zinc-900">{match.targetTeam.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Opponent</p>
          <p className="mt-1 text-sm text-zinc-900">{match.opponent}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Home / Away</p>
          <p className="mt-1 text-sm text-zinc-900">{formatMatchVenue(match.homeOrAway)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Squad Size</p>
          <p className="mt-1 text-sm text-zinc-900">{match.squadSize}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Min Support</p>
          <p className="mt-1 text-sm text-zinc-900">{match.targetTeam.minSupportPlayers}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Support Sources</p>
          <p className="mt-1 text-sm text-zinc-900">
            {supportSourceTeams.length > 0 ? supportSourceTeams.join(", ") : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Development Slots</p>
          <p className="mt-1 text-sm text-zinc-900">{match.targetTeam.developmentSlots}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Development Sources</p>
          <p className="mt-1 text-sm text-zinc-900">
            {developmentSourceTeams.length > 0 ? developmentSourceTeams.join(", ") : "-"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Match Type</p>
          <p className="mt-1 text-sm text-zinc-900">{match.matchType ?? "-"}</p>
        </div>
        <div className="sm:col-span-2 xl:col-span-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">{match.notes ?? "-"}</p>
        </div>
      </section>

      <section className="grid gap-4 border border-zinc-200 bg-white p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Active Players</p>
          <p className="mt-1 text-sm text-zinc-900">{activePlayerCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Latest Selection</p>
          <p className="mt-1 text-sm text-zinc-900">{latestSelection?.status ?? "None yet"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Selected Players</p>
          <p className="mt-1 text-sm text-zinc-900">
            {selectedCount} / {match.squadSize}
          </p>
        </div>
      </section>

      {latestSelection ? (
        <section className="flex flex-col gap-3 border border-zinc-200 bg-white p-5">
          <div>
            <h2 className="text-lg font-semibold">Current Saved Selection</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Latest saved rows for this match, including role, source team, explanation, and
              whether each row came from generation or manual changes.
            </p>
          </div>

          {latestSelection.overrideNotes ? (
            <div className="border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <p className="font-medium text-zinc-950">Override note</p>
              <p className="mt-1 whitespace-pre-wrap">{latestSelection.overrideNotes}</p>
            </div>
          ) : null}

          <SavedSelectionTable
            rows={activeSavedPlayers.map((player) => ({
              explanation: player.explanation ?? "-",
              id: player.id,
              playerName: formatPlayerName(player.player),
              role: formatSelectionRole(player.roleType),
              sourceTeam: player.sourceTeamNameSnapshot,
              trace: formatSelectionTrace(player),
            }))}
          />

          {removedSavedPlayers.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-base font-semibold">Removed Players</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Players preserved in the saved record as explicit manual removals.
                </p>
              </div>

              <SavedSelectionTable
                rows={removedSavedPlayers.map((player) => ({
                  explanation: player.explanation ?? "-",
                  id: player.id,
                  playerName: formatPlayerName(player.player),
                  role: formatSelectionRole(player.roleType),
                  sourceTeam: player.sourceTeamNameSnapshot,
                  trace: formatSelectionTrace(player),
                }))}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Suggested Squad</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Generate a first-pass squad using the current backend selection engine.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={generateAction}>
              <button
                className="h-10 rounded border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                type="submit"
              >
                Generate suggested squad
              </button>
            </form>
            <form action={recalculateAction}>
              <button
                className="h-10 rounded border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
                disabled={latestSelectionIsFinalized}
                type="submit"
              >
                Recalculate draft
              </button>
            </form>
          </div>
        </div>

        {generatedSelection ? (
          <div className="mt-6 flex flex-col gap-6">
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="border border-zinc-200 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Selected</p>
                <p className="mt-1 text-sm text-zinc-900">
                  {generatedSelection.selectedPlayers.length}
                </p>
              </div>
              <div className="border border-zinc-200 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Excluded</p>
                <p className="mt-1 text-sm text-zinc-900">
                  {generatedSelection.excludedPlayers.length}
                </p>
              </div>
              <div className="border border-zinc-200 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Warnings</p>
                <p className="mt-1 text-sm text-zinc-900">{generatedSelection.warnings.length}</p>
              </div>
            </section>

            <form action={acceptGeneratedAction}>
              <div className="flex flex-col gap-2">
                <button
                  className="h-10 rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  Use suggestion as draft
                </button>
                <p className="text-sm text-zinc-600">
                  This saves the suggested squad as the current draft for the match so you can edit
                  it manually before finalizing.
                </p>
              </div>
            </form>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">Warnings</h3>
              {generatedSelection.warnings.length > 0 ? (
                <div className="border border-zinc-200">
                  {generatedSelection.warnings.map((warning) => (
                    <div
                      key={warning.code + warning.message}
                      className="border-b border-zinc-200 px-4 py-3 text-sm text-zinc-700 last:border-b-0"
                    >
                      <p className="font-medium text-zinc-950">{warning.code}</p>
                      <p className="mt-1">{warning.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No warnings for this suggestion.</p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">Selected Players</h3>
              {generatedSelection.selectedPlayers.length > 0 ? (
                <GeneratedSelectedTable
                  rows={generatedSelection.selectedPlayers.map((player) => ({
                    coreTeam: player.coreTeamName,
                    explanation: formatReasonList([
                      player.selectionReason,
                      ...player.explanations.map((explanation) => explanation.summary),
                    ]),
                    playerId: player.playerId,
                    playerName: player.playerName,
                    position: player.chosenPosition ?? player.playerPosition,
                    role: formatSelectionRole(player.selectionCategory as SelectionRole),
                    sourceTeam: player.selectionCategory === "CORE" ? "-" : player.coreTeamName,
                    trace: player.autoSelected ? "Auto-generated" : "Manual",
                  }))}
                />
              ) : (
                <p className="text-sm text-zinc-500">No players were selected by this first pass.</p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">Excluded Players</h3>
              {generatedSelection.excludedPlayers.length > 0 ? (
                <GeneratedExcludedTable
                  rows={generatedSelection.excludedPlayers.map((player) => ({
                    coreTeam: player.coreTeamName,
                    explanation: formatReasonList([
                      player.exclusionReason,
                      ...player.explanations.map((explanation) => explanation.summary),
                    ]),
                    playerId: player.playerId,
                    playerName: player.playerName,
                    position: player.playerPosition,
                    trace: player.autoSelected ? "Auto-generated" : "Manual",
                  }))}
                />
              ) : (
                <p className="text-sm text-zinc-500">No players were excluded by this first pass.</p>
              )}
            </section>
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">
            No suggestion generated yet. Use the button above to create a basic squad suggestion.
          </p>
        )}
      </section>

      <form action={saveAction} className="flex flex-col gap-6">
        {generatedSelection ? <input name="returnToGenerated" type="hidden" value="1" /> : null}

        {latestSelection ? (
          <input name="baselineSelectionId" type="hidden" value={latestSelection.id} />
        ) : null}

        {!latestSelection && generatedSelection ? (
          <>
            {generatedSelection.selectedPlayers.map((player) => (
              <div key={player.playerId} hidden>
                <input name="generatedBaselinePlayerIds" type="hidden" value={player.playerId} />
                <input
                  name={`generatedBaselineRoleType:${player.playerId}`}
                  type="hidden"
                  value={player.selectionCategory}
                />
                <input
                  name={`generatedBaselineSourceTeam:${player.playerId}`}
                  type="hidden"
                  value={player.coreTeamName}
                />
                <input
                  name={`generatedBaselineExplanation:${player.playerId}`}
                  type="hidden"
                  value={formatReasonList([
                    player.selectionReason,
                    ...player.explanations.map((explanation) => explanation.summary),
                  ])}
                />
              </div>
            ))}
          </>
        ) : null}

        <section className="border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-2">
            <label
              className="text-xs font-medium uppercase tracking-wide text-zinc-500"
              htmlFor="overrideNotes"
            >
              Override note
            </label>
            <textarea
              className="min-h-24 border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={latestSelection?.overrideNotes ?? ""}
              id="overrideNotes"
              name="overrideNotes"
              placeholder="Optional note about why the squad was adjusted manually."
            />
          </div>
        </section>

        <PlayerPickList
          developmentSourceTeamIds={match.targetTeam.developmentTargetRelationships.map(
            (relationship) => relationship.sourceTeam.id,
          )}
          groupedPlayers={groupedPlayers}
          selectedRoleByPlayerId={selectedRoleByPlayerId}
          supportSourceTeamIds={match.targetTeam.supportTargetRelationships.map(
            (relationship) => relationship.sourceTeam.id,
          )}
          targetTeamId={match.targetTeamId}
        />

        <div className="flex flex-wrap gap-3">
          <button
            className="h-10 rounded border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            name="intent"
            type="submit"
            value="DRAFT"
          >
            Save draft
          </button>
          <button
            className="h-10 rounded bg-zinc-950 px-4 text-sm font-semibold text-white"
            name="intent"
            type="submit"
            value="FINALIZED"
          >
            Finalize selection
          </button>
          <Link
            className="inline-flex h-10 items-center rounded border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-white"
            href="/matches"
          >
            Back to matches
          </Link>
        </div>
      </form>
    </div>
  );
}
