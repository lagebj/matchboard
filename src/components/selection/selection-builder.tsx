import Link from "next/link";
import type { Match, MatchSelection, MatchSelectionPlayer, Player, SelectionRole, SelectionStatus, Team } from "@/generated/prisma/client";
import {
  acceptGeneratedSelectionAction,
  generateSuggestedSelectionAction,
  saveManualSelectionAction,
} from "@/app/selection/[matchId]/actions";
import { recalculateMatchAction, resetSelectionsAction } from "@/app/matches/actions";
import {
  GeneratedExcludedTable,
} from "@/components/selection/generated-excluded-table";
import {
  GeneratedSelectedTable,
} from "@/components/selection/generated-selected-table";
import { PlayerPickList } from "@/components/selection/player-pick-list";
import { SavedSelectionTable } from "@/components/selection/saved-selection-table";
import { formatDate, formatIsoWeekKey, formatIsoWeekLabel } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";
import { formatPlayerName } from "@/lib/player-metrics";
import type { WeeklyCoverageRow } from "@/lib/selection/get-weekly-player-coverage";
import type { AutomaticSelectionCategory, GeneratedSelection } from "@/lib/selection/types";

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
  isWeekFullyFinalized: boolean;
  latestSelection: SelectionWithPlayers | null;
  match: MatchWithTeam;
  nextMatchId: string | null;
  previousMatchId: string | null;
  recalculated: boolean;
  resetMessage?: string;
  savedMessage?: string;
  sameWeekMatches: Array<{
    id: string;
    latestSelectionStatus: SelectionStatus | null;
    opponent: string;
    startsAt: Date;
    targetTeam: Pick<Team, "id" | "name">;
  }>;
  selectionAnalysis: GeneratedSelection | null;
  weeklyCoverage: WeeklyCoverageRow[];
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

type ManualAddSuggestionRow = {
  explanation: string;
  playerId: string;
  playerName: string;
  role: string;
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

function getManualSuggestionPriority(category: AutomaticSelectionCategory | null) {
  if (category === "SUPPORT") {
    return 0;
  }

  if (category === "DEVELOPMENT") {
    return 1;
  }

  if (category === "CORE") {
    return 2;
  }

  return 3;
}

function formatWeekMatchState(status: SelectionStatus | null): string {
  if (status === "FINALIZED") {
    return "Finalized";
  }

  if (status === "DRAFT") {
    return "Draft";
  }

  return "Not started";
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
  isWeekFullyFinalized,
  latestSelection,
  match,
  nextMatchId,
  previousMatchId,
  recalculated,
  resetMessage,
  savedMessage,
  sameWeekMatches,
  selectionAnalysis,
  weeklyCoverage,
}: SelectionBuilderProps) {
  const acceptGeneratedAction = acceptGeneratedSelectionAction.bind(null, match.id);
  const generateAction = generateSuggestedSelectionAction.bind(null, match.id);
  const recalculateAction = recalculateMatchAction.bind(null, match.id);
  const resetAction = resetSelectionsAction;
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
  const savedSelectionGap = match.squadSize - activeSavedPlayers.length;
  const weeklyWarningCount = weeklyCoverage.filter((row) => row.severity === "warning").length;
  const weeklyInfoCount = weeklyCoverage.length - weeklyWarningCount;
  const weekLabel = formatIsoWeekLabel(match.startsAt);
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
  const latestSelectionStateLabel = latestSelection
    ? latestSelection.status === "FINALIZED"
      ? "Finalized"
      : "Draft in progress"
    : "No saved selection";
  const selectedCountLabel = `${selectedCount} / ${match.squadSize}`;
  const suggestedSelectedCount = generatedSelection?.selectedPlayers.length ?? 0;
  const suggestedExcludedCount = generatedSelection?.excludedPlayers.length ?? 0;
  const suggestedWarningCount = generatedSelection?.warnings.length ?? 0;
  const currentShortfall =
    latestSelection && savedSelectionGap > 0
      ? savedSelectionGap
      : !latestSelection && generatedSelection
        ? Math.max(match.squadSize - generatedSelection.selectedPlayers.length, 0)
        : 0;
  const currentSelectedPlayerIds = latestSelection ? activeSavedPlayerIds : generatedSelectedPlayerIds;
  const manualAddSuggestions: ManualAddSuggestionRow[] =
    currentShortfall > 0
      ? (selectionAnalysis?.excludedPlayers ?? [])
          .filter(
            (player) =>
              player.eligibility &&
              player.automaticSelectionCategory !== null &&
              !currentSelectedPlayerIds.has(player.playerId),
          )
          .sort((left, right) => {
            const priorityDifference =
              getManualSuggestionPriority(left.automaticSelectionCategory) -
              getManualSuggestionPriority(right.automaticSelectionCategory);

            if (priorityDifference !== 0) {
              return priorityDifference;
            }

            return left.playerName.localeCompare(right.playerName);
          })
          .slice(0, Math.min(Math.max(currentShortfall, 3), 6))
          .map((player) => ({
            explanation: player.exclusionReason,
            playerId: player.playerId,
            playerName: player.playerName,
            role: formatSelectionRole(player.automaticSelectionCategory as SelectionRole),
          }))
      : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="app-panel-raised rounded-[1.9rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Match Workspace
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">
                {match.targetTeam.name} vs. {match.opponent}
              </h1>
              <p className="mt-3 text-sm app-copy-soft">
                Work the week first, then decide whether this one needs a fresh pass, an edit, or a lock.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {previousMatchId ? (
                <Link
                  className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                  href={`/selection/${previousMatchId}`}
                >
                  Previous match
                </Link>
              ) : null}
              {nextMatchId ? (
                <Link
                  className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                  href={`/selection/${nextMatchId}`}
                >
                  Next match
                </Link>
              ) : null}
              <Link
                className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                href="/matches"
              >
                Back to matches
              </Link>
              <form action={resetAction}>
                <input name="resetScope" type="hidden" value="match" />
                <input name="returnPath" type="hidden" value={`/selection/${match.id}`} />
                <input name="selectedMatchIds" type="hidden" value={match.id} />
                <button
                  className="inline-flex h-10 items-center rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-4 text-sm font-medium text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.14)] hover:text-white"
                  type="submit"
                >
                  Reset this match
                </button>
              </form>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Week
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-50">{weekLabel}</p>
              <p className="mt-2 text-sm app-copy-soft">
                {sameWeekMatches.length} registered fixture{sameWeekMatches.length === 1 ? "" : "s"} in
                this operating window.
              </p>
            </div>
            <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Match State
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-50">{latestSelectionStateLabel}</p>
              <p className="mt-2 text-sm app-copy-soft">
                {latestSelectionIsFinalized
                  ? "Locked."
                  : latestSelection
                    ? "Draft saved."
                    : "No saved selection yet."}
              </p>
            </div>
            <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Squad Coverage
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-50">{selectedCountLabel}</p>
              <p className="mt-2 text-sm app-copy-soft">Current count against target.</p>
            </div>
            <div className="rounded-2xl border app-hairline bg-[var(--surface-muted)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Week Coverage
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-50">
                {weeklyWarningCount} warning{weeklyWarningCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-sm app-copy-soft">
                {weeklyInfoCount > 0
                  ? `${weeklyInfoCount} softer signal(s) also sit in the week.`
                  : "Every eligible player is covered this week."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Match Snapshot
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <p className="app-copy-muted">Date</p>
                  <p className="mt-1 text-zinc-100">{formatDate(match.startsAt)}</p>
                </div>
                <div>
                  <p className="app-copy-muted">Venue</p>
                  <p className="mt-1 text-zinc-100">{formatMatchVenue(match.homeOrAway)}</p>
                </div>
                <div>
                  <p className="app-copy-muted">Match type</p>
                  <p className="mt-1 text-zinc-100">{match.matchType ?? "-"}</p>
                </div>
                <div>
                  <p className="app-copy-muted">Squad size</p>
                  <p className="mt-1 text-zinc-100">{match.squadSize}</p>
                </div>
                <div>
                  <p className="app-copy-muted">Active players</p>
                  <p className="mt-1 text-zinc-100">{activePlayerCount}</p>
                </div>
                <div>
                  <p className="app-copy-muted">Target team</p>
                  <p className="mt-1 text-zinc-100">{match.targetTeam.name}</p>
                </div>
                <div>
                  <p className="app-copy-muted">Development work</p>
                  <p className="mt-1 text-zinc-100">
                    {match.availableForDevelopmentSlot
                      ? `${match.targetTeam.developmentSlots} slot${match.targetTeam.developmentSlots === 1 ? "" : "s"} open`
                      : "Closed for this match"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.03)] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                Notes
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm app-copy-soft">
                {match.notes ?? "No match notes recorded."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {savedMessage ? (
        <div className="rounded-2xl border app-hairline bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-[var(--accent-strong)]">
          {formatSavedStatus(savedMessage)}
        </div>
      ) : null}

      {resetMessage ? (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.34)] bg-[rgba(185,128,119,0.12)] px-4 py-3 text-sm text-[#f0cbc5]">
          {resetMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-[rgba(185,128,119,0.4)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[#f0cbc5]">
          {errorMessage}
        </div>
      ) : null}

      {acceptedGenerated ? (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm app-copy-soft">
          Suggested squad saved as the current draft. You can adjust it below before finalizing.
        </div>
      ) : null}

      {recalculated ? (
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm app-copy-soft">
          Draft selection recalculated for this match.
        </div>
      ) : null}

      <section id="week-coverage" className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="app-panel rounded-[1.5rem] p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                  Week Workflow
                </p>
                <h2 className="text-xl font-semibold text-zinc-50">Keep the whole week in view</h2>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                  isWeekFullyFinalized
                    ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
                    : "border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
                }`}
              >
                {isWeekFullyFinalized ? "Week finalized" : "Week in progress"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm app-copy-soft">Read the lanes here, or switch to the full week board.</p>
              <Link
                className="inline-flex h-9 items-center rounded-full border app-hairline px-3 text-xs font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                href={`/weeks/${formatIsoWeekKey(match.startsAt)}`}
              >
                Open week board
              </Link>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-full gap-3">
              {sameWeekMatches.map((sameWeekMatch) => (
                <div
                  key={sameWeekMatch.id}
                  className={`min-w-[15rem] flex-1 rounded-2xl border px-4 py-4 ${
                    sameWeekMatch.id === match.id
                      ? "border-[var(--border-strong)] bg-[rgba(140,167,146,0.1)]"
                      : "app-hairline bg-[rgba(255,255,255,0.025)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        {sameWeekMatch.targetTeam.name} vs. {sameWeekMatch.opponent}
                      </p>
                      <p className="mt-1 text-sm app-copy-soft">{formatDate(sameWeekMatch.startsAt)}</p>
                    </div>
                    <span className="rounded-full border app-hairline px-3 py-1 text-[11px] uppercase tracking-[0.18em] app-copy-soft">
                      {formatWeekMatchState(sameWeekMatch.latestSelectionStatus)}
                    </span>
                  </div>
                  {sameWeekMatch.id !== match.id ? (
                    <Link
                      className="mt-4 inline-flex text-sm font-medium text-[var(--accent-strong)] hover:text-zinc-50"
                      href={`/selection/${sameWeekMatch.id}`}
                    >
                      Open workspace
                    </Link>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--accent-strong)]">Current workspace</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-[rgba(208,176,127,0.24)] bg-[rgba(255,255,255,0.03)] p-5">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--warning)]">
              Week Coverage
            </p>
            <h2 className="text-xl font-semibold text-zinc-50">Players still missing a match this week</h2>
          <p className="text-sm app-copy-soft">Warnings need action. Info rows are softer week context.</p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {weeklyCoverage.length > 0 ? (
              weeklyCoverage.map((row) => (
                <div
                  key={row.playerId}
                  className={`rounded-2xl border px-4 py-4 text-sm ${
                    row.severity === "warning"
                      ? "border-[rgba(208,176,127,0.28)] bg-[rgba(208,176,127,0.1)] text-[#f3dfc1]"
                      : "app-hairline bg-[rgba(255,255,255,0.03)] app-copy-soft"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium text-zinc-100">{row.playerName}</p>
                    <span className="rounded-full border app-hairline px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                      {row.severity === "warning" ? "Warning" : "Info"}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] app-copy-muted">
                      {row.teamName}
                    </span>
                  </div>
                  <p className="mt-2 leading-6">{row.reason}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] app-copy-muted">
                    Eligible this week: {row.eligibleMatchLabels.join(" · ")}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 text-sm app-copy-soft">
                No uncovered active available players in this week. The current saved or generated
                picture covers every eligible player.
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="app-panel rounded-[1.5rem] p-5">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Assistant Suggestions
          </p>
          <h2 className="text-xl font-semibold text-zinc-50">Suggested next actions for this workspace</h2>
          <p className="text-sm app-copy-soft">Take the next move from here.</p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {!generatedSelection && !latestSelection ? (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Run a first pass</p>
              <p className="mt-2 text-sm leading-6 app-copy-soft">
                My suggestion is to generate a first draft before editing manually, so the week
                pressure and omissions become visible immediately.
              </p>
              <form action={generateAction} className="mt-4">
                <button
                  className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  type="submit"
                >
                  Generate suggestion
                </button>
              </form>
            </div>
          ) : null}

          {generatedSelection && !latestSelectionIsFinalized ? (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Promote the current suggestion</p>
              <p className="mt-2 text-sm leading-6 app-copy-soft">
                If the suggestion is close enough, use it as the draft baseline and only spend
                manual edits where the week still needs judgement.
              </p>
              <form action={acceptGeneratedAction} className="mt-4">
                <button
                  className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.07)] hover:text-zinc-50"
                  type="submit"
                >
                  Use suggestion as draft
                </button>
              </form>
            </div>
          ) : null}

          {weeklyWarningCount > 0 ? (
            <div className="rounded-2xl border border-[rgba(208,176,127,0.28)] bg-[rgba(208,176,127,0.1)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Review uncovered week players</p>
              <p className="mt-2 text-sm leading-6 text-[#f3dfc1]">
                {weeklyWarningCount} player{weeklyWarningCount === 1 ? "" : "s"} still have no match
                this week and are not covered by a core-drop allowance.
              </p>
              <Link
                className="mt-4 inline-flex text-sm font-medium text-[#f8ead4] hover:text-zinc-50"
                href="#week-coverage"
              >
                Open week coverage
              </Link>
            </div>
          ) : null}

          {latestSelection && !latestSelectionIsFinalized ? (
            <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Rebuild the wider draft picture</p>
              <p className="mt-2 text-sm leading-6 app-copy-soft">
                When you save manual changes, other draft matches are recalculated around this saved
                state. Use a manual recalc here when you want a fresh engine pass that still checks
                every other saved draft and finalized match before it writes the new draft.
              </p>
              <form action={recalculateAction} className="mt-4">
                <button
                  className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.07)] hover:text-zinc-50"
                  type="submit"
                >
                  Recalculate draft
                </button>
              </form>
            </div>
          ) : null}

          {latestSelection && !latestSelectionIsFinalized && earlyWarnings.length === 0 && savedSelectionGap === 0 ? (
            <div className="rounded-2xl border border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.1)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Ready to finalize</p>
              <p className="mt-2 text-sm leading-6 app-copy-soft">
                This draft currently matches squad size and has no early warning banners. Move to
                the edit lane if you want to lock it into history now.
              </p>
              <Link
                className="mt-4 inline-flex text-sm font-medium text-[var(--accent-strong)] hover:text-zinc-50"
                href="#manual-workspace"
              >
                Open edit lane
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {(
        earlyWarnings.length > 0 ||
        currentShortfall > 0 ||
        savedOmittedCorePlayers.length > 0 ||
        generatedOmittedCorePlayers.length > 0
      ) ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          {(earlyWarnings.length > 0 || currentShortfall > 0) ? (
            <section className="rounded-[1.5rem] border border-[rgba(208,176,127,0.35)] bg-[rgba(208,176,127,0.1)] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--warning)]">
                Early Warnings
              </h2>
              <div className="mt-4 flex flex-col gap-3 text-sm text-[#f3dfc1]">
                {earlyWarnings.map((warning) => (
                  <div
                    key={warning.code + warning.message}
                    className="rounded-2xl border border-[rgba(208,176,127,0.22)] bg-[rgba(18,22,30,0.42)] px-4 py-3"
                  >
                    <p className="font-medium text-[#f8ead4]">{warning.title}</p>
                    <p className="mt-1 leading-6">{warning.message}</p>
                  </div>
                ))}

                {currentShortfall > 0 ? (
                  <div className="rounded-2xl border border-[rgba(208,176,127,0.22)] bg-[rgba(18,22,30,0.42)] px-4 py-3">
                    <p className="font-medium text-[#f8ead4]">Best-effort manual additions</p>
                    <p className="mt-1 leading-6">
                      This match is still {currentShortfall} player(s) short. These players were
                      blocked by the rules engine, but they are the clearest manual-add candidates if
                      you want to override those rules.
                    </p>
                    <div className="mt-3 flex flex-col gap-3">
                      {manualAddSuggestions.length > 0 ? (
                        manualAddSuggestions.map((player) => (
                          <div
                            key={player.playerId}
                            className="rounded-xl border border-[rgba(208,176,127,0.18)] bg-[rgba(255,255,255,0.03)] px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="font-medium text-[#f8ead4]">{player.playerName}</p>
                              <span className="rounded-full border border-[rgba(208,176,127,0.2)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f3dfc1]">
                                {player.role}
                              </span>
                            </div>
                            <p className="mt-2 leading-6">{player.explanation}</p>
                          </div>
                        ))
                      ) : (
                        <p className="leading-6">
                          No rule-blocked fallback candidates are available right now. Any remaining
                          additions will need pure manual judgment.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {(savedOmittedCorePlayers.length > 0 || generatedOmittedCorePlayers.length > 0) ? (
            <section className="app-panel rounded-[1.5rem] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Core Omissions
              </h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {savedOmittedCorePlayers.length > 0 ? (
                  <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                    <h3 className="text-base font-semibold text-zinc-50">Saved selection</h3>
                    <p className="mt-1 text-sm app-copy-soft">
                      {match.targetTeam.name} core players not currently in the saved selection.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      {savedOmittedCorePlayers.map((player) => (
                        <div key={player.playerId} className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.16)] px-4 py-3 text-sm">
                          <p className="font-medium text-zinc-100">{player.playerName}</p>
                          <p className="mt-1 leading-6 app-copy-soft">{player.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {generatedOmittedCorePlayers.length > 0 ? (
                  <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                    <h3 className="text-base font-semibold text-zinc-50">Current suggestion</h3>
                    <p className="mt-1 text-sm app-copy-soft">
                      {match.targetTeam.name} core players the current suggestion did not pick.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      {generatedOmittedCorePlayers.map((player) => (
                        <div key={player.playerId} className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.16)] px-4 py-3 text-sm">
                          <p className="font-medium text-zinc-100">{player.playerName}</p>
                          <p className="mt-1 leading-6 app-copy-soft">{player.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

      {latestSelection ? (
        <section className="app-panel rounded-[1.6rem] p-5">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Current Saved Selection</h2>
            <p className="mt-1 text-sm app-copy-soft">
              Latest saved rows for this match, including role, source team, explanation, and
              whether each row came from generation or manual changes.
            </p>
          </div>

          {latestSelection.overrideNotes ? (
            <div className="mt-4 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3 text-sm app-copy-soft">
              <p className="font-medium text-zinc-100">Override note</p>
              <p className="mt-1 whitespace-pre-wrap">{latestSelection.overrideNotes}</p>
            </div>
          ) : null}

          <div className="mt-4">
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
          </div>

          {removedSavedPlayers.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-50">Removed Players</h3>
                <p className="mt-1 text-sm app-copy-soft">
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

      <section className="app-panel rounded-[1.6rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Review Lane
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Suggested Squad</h2>
            <p className="mt-1 text-sm leading-6 app-copy-soft">
              Generate or recalculate the current engine view, inspect the warnings, then adopt it
              as a draft only if it gives you a solid starting point.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={generateAction}>
              <button
                className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                type="submit"
              >
                Generate suggestion
              </button>
            </form>
            <form action={recalculateAction}>
              <button
                className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.07)] hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
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
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Suggested selected
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{suggestedSelectedCount}</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Suggested excluded
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{suggestedExcludedCount}</p>
              </div>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                  Generated warnings
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-50">{suggestedWarningCount}</p>
              </div>
            </section>

            <form action={acceptGeneratedAction}>
              <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Promote this suggestion into the edit lane</p>
                    <p className="mt-1 text-sm app-copy-soft">
                      Save the suggestion as the current draft so manual changes and final review
                      happen against a stored baseline.
                    </p>
                  </div>
                  <button
                    className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    type="submit"
                  >
                    Use suggestion as draft
                  </button>
                </div>
              </div>
            </form>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-50">Suggestion warnings</h3>
              {generatedSelection.warnings.length > 0 ? (
                <div className="grid gap-3">
                  {generatedSelection.warnings.map((warning) => (
                    <div
                      key={warning.code + warning.message}
                      className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-3 text-sm"
                    >
                      <p className="font-medium text-zinc-100">{warning.code}</p>
                      <p className="mt-1 leading-6 app-copy-soft">{warning.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm app-copy-muted">No warnings for this suggestion.</p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-50">Selected players</h3>
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
                <p className="text-sm app-copy-muted">No players were selected by this first pass.</p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-50">Excluded players</h3>
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
                <p className="text-sm app-copy-muted">No players were excluded by this first pass.</p>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-5 text-sm app-copy-soft">
            No suggestion generated yet. Start with a first-pass squad, then decide whether it is
            worth promoting into the editable draft.
          </div>
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

        <section id="manual-workspace" className="app-panel-raised rounded-[1.6rem] p-5">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Edit Lane
              </p>
              <h2 className="text-xl font-semibold text-zinc-50">Manual selection workspace</h2>
              <p className="max-w-3xl text-sm leading-6 app-copy-soft">
                Confirm the final player list, adjust roles where needed, and leave a short note if
                the saved squad differs from the engine recommendation. Saving here also refreshes
                the remaining draft matches around this saved state, with the wider saved draft and
                finalized board taken into account.
              </p>
            </div>

            <section className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <div className="flex flex-col gap-2">
                <label
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted"
                  htmlFor="overrideNotes"
                >
                  Override note
                </label>
                <textarea
                  className="min-h-24 rounded-2xl border app-hairline bg-[rgba(8,10,14,0.32)] px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
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
                className="h-10 rounded-full border app-hairline bg-[rgba(255,255,255,0.04)] px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.07)] hover:text-zinc-50"
                name="intent"
                type="submit"
                value="DRAFT"
              >
                Save draft
              </button>
              <button
                className="h-10 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                name="intent"
                type="submit"
                value="FINALIZED"
              >
                Finalize selection
              </button>
              <Link
                className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                href="/matches"
              >
                Back to matches
              </Link>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
