import Link from "next/link";
import { notFound } from "next/navigation";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { removePlayerAction, togglePlayerActiveAction, updatePlayerAction } from "@/app/players/actions";
import { PlayerEditorForm, PlayerSummaryCard } from "@/components/players/player-editor-form";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatSelectionRole, isFloatingSelectionRole } from "@/lib/match-utils";
import {
  formatAvailabilityStatus,
  formatBestSide,
  formatPlayerName,
  formatPreferredFoot,
  formatSecondaryFoot,
  getOverallStarRating,
  getPlayerAttributeAverages,
  getPlayerPositionSummary,
} from "@/lib/player-metrics";

type PlayerPageProps = {
  params: Promise<{
    playerId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

type RoleBreakdownCardProps = {
  count: number;
  label: string;
};

type SnapshotCardProps = {
  label: string;
  value: string;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "updated") {
    return "Player updated.";
  }

  if (saved === "status") {
    return "Player status updated.";
  }

  return null;
}

function formatRoleCount(history: Array<{ roleType: SelectionRole }>, roleType: SelectionRole): number {
  return history.filter((entry) => entry.roleType === roleType).length;
}

function SnapshotCard({ label, value }: SnapshotCardProps) {
  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function RoleBreakdownCard({ count, label }: RoleBreakdownCardProps) {
  return (
    <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-50">{count}</p>
    </div>
  );
}

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const [{ playerId }, { error, saved }] = await Promise.all([params, searchParams]);

  const [player, teams, orderedPlayerIds, finalizedHistory] = await Promise.all([
    db.player.findFirst({
      where: {
        id: playerId,
        removedAt: null,
      },
      include: {
        coreTeam: {
          select: {
            id: true,
            name: true,
          },
        },
        allowedFloatTeams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            team: {
              name: "asc",
            },
          },
        },
      },
    }),
    db.team.findMany({
      where: {
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.player.findMany({
      where: {
        removedAt: null,
      },
      select: {
        id: true,
      },
      orderBy: [
        {
          coreTeam: {
            name: "asc",
          },
        },
        { firstName: "asc" },
        { lastName: "asc" },
        { playerCode: "asc" },
      ],
    }),
    db.matchSelectionPlayer.findMany({
      where: {
        playerId,
        wasManuallyRemoved: false,
        selection: {
          status: SelectionStatus.FINALIZED,
        },
      },
      select: {
        id: true,
        roleType: true,
        targetTeamNameSnapshot: true,
        selection: {
          select: {
            match: {
              select: {
                id: true,
                opponent: true,
                startsAt: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          selection: {
            match: {
              startsAt: "desc",
            },
          },
        },
      ],
    }),
  ]);

  if (!player) {
    notFound();
  }

  const averages = getPlayerAttributeAverages(player);
  const overallStars = getOverallStarRating(averages.overall);
  const orderedIds = orderedPlayerIds.map((entry) => entry.id);
  const currentPlayerIndex = orderedIds.indexOf(player.id);
  const previousPlayerId = currentPlayerIndex > 0 ? orderedIds[currentPlayerIndex - 1] : null;
  const nextPlayerId =
    currentPlayerIndex >= 0 && currentPlayerIndex < orderedIds.length - 1
      ? orderedIds[currentPlayerIndex + 1]
      : null;
  const saveAction = updatePlayerAction.bind(null, player.id);
  const toggleAction = togglePlayerActiveAction.bind(null, player.id);
  const removeAction = removePlayerAction.bind(null, player.id);

  const totalFinalizedAppearances = finalizedHistory.length;
  const totalFloatingAppearances = finalizedHistory.filter((entry) =>
    isFloatingSelectionRole(entry.roleType),
  ).length;
  const coreAppearances = formatRoleCount(finalizedHistory, SelectionRole.CORE);
  const supportAppearances = formatRoleCount(finalizedHistory, SelectionRole.SUPPORT);
  const developmentAppearances = formatRoleCount(finalizedHistory, SelectionRole.DEVELOPMENT);
  const floatAppearances = formatRoleCount(finalizedHistory, SelectionRole.FLOAT);
  const lastFinalizedAppearance = finalizedHistory[0] ?? null;
  const availableFloatTeams = player.allowedFloatTeams.map((entry) => entry.team.name).join(", ");

  return (
    <main className="flex min-h-full flex-col gap-8 text-foreground">
      <div className="flex flex-col gap-8">
        <section className="app-panel-raised rounded-[1.9rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-4xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                  Player Profile
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-4xl">
                    {formatPlayerName(player)}
                  </h1>
                  <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] app-copy-soft">
                    {player.coreTeam.name}
                  </span>
                  <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] app-copy-soft">
                    {formatAvailabilityStatus(player.currentAvailability)}
                  </span>
                  <span className="rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] app-copy-soft">
                    {player.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-7 app-copy-soft">
                  Inspect the player first, then edit the record below. This page is meant to give
                  a quick football profile readout before you start changing registry data.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {previousPlayerId ? (
                  <Link
                    className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                    href={`/players/${previousPlayerId}`}
                  >
                    Previous player
                  </Link>
                ) : null}
                {nextPlayerId ? (
                  <Link
                    className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                    href={`/players/${nextPlayerId}`}
                  >
                    Next player
                  </Link>
                ) : null}
                <Link
                  className="inline-flex h-10 items-center rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                  href="/players"
                >
                  Back to players
                </Link>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
              <div className="rounded-[1.6rem] border app-hairline bg-[rgba(255,255,255,0.03)] p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
                  <div>
                    <PlayerSummaryCard player={player} />
                  </div>
                  <div className="rounded-[1.4rem] border app-hairline bg-[rgba(8,10,14,0.28)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
                      Overall rating
                    </p>
                    <p className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-zinc-50">
                      {averages.overall}
                    </p>
                    <p
                      className="mt-3 text-base text-[#d0b07f]"
                      aria-label={`${overallStars} star overall rating`}
                    >
                      {"★".repeat(overallStars)}
                      <span className="text-zinc-600">{"★".repeat(5 - overallStars)}</span>
                    </p>
                    <p className="mt-4 text-sm app-copy-soft">
                      Based on the tracked technical, tactical, mental, and physical attributes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <SnapshotCard
                  label="Position stack"
                  value={getPlayerPositionSummary(player)}
                />
                <SnapshotCard
                  label="Foot profile"
                  value={`${formatPreferredFoot(player.preferredFoot)} / ${formatSecondaryFoot(player.secondaryFoot)} / ${formatBestSide(player.bestSide)}`}
                />
                <SnapshotCard
                  label="Floating eligibility"
                  value={
                    player.isFloating
                      ? availableFloatTeams || "Floating enabled with no extra teams configured"
                      : "Core team only"
                  }
                />
                <SnapshotCard
                  label="Special flags"
                  value={`${player.canDropCoreMatch ? "Can drop one core match" : "No core-match drop"}${player.maxDevelopmentMatches !== null ? ` · Dev cap ${player.maxDevelopmentMatches}` : " · No development cap"}`}
                />
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-[rgba(185,128,119,0.4)] bg-[rgba(185,128,119,0.14)] px-4 py-3 text-sm text-[#f0cbc5]">
            {error}
          </div>
        ) : null}

        {formatSavedMessage(saved) ? (
          <div className="rounded-2xl border app-hairline bg-[rgba(140,167,146,0.12)] px-4 py-3 text-sm text-[var(--accent-strong)]">
            {formatSavedMessage(saved)}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="app-panel rounded-[1.6rem] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Attribute Readout
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Category snapshot</h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <RoleBreakdownCard count={averages.technical} label="Technical" />
              <RoleBreakdownCard count={averages.tactical} label="Tactical" />
              <RoleBreakdownCard count={averages.mental} label="Mental" />
              <RoleBreakdownCard count={averages.physical} label="Physical" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-sm font-semibold text-zinc-100">Profile fit</p>
                <p className="mt-2 text-sm leading-7 app-copy-soft">
                  {player.primaryPosition} is the leading role, backed by {player.secondaryPosition ?? "no secondary position"} and {player.tertiaryPosition ?? "no tertiary position"}.
                </p>
              </div>
              <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-sm font-semibold text-zinc-100">Availability context</p>
                <p className="mt-2 text-sm leading-7 app-copy-soft">
                  Registry status is {player.active ? "active" : "inactive"} and the current
                  availability flag is {formatAvailabilityStatus(player.currentAvailability).toLowerCase()}.
                </p>
              </div>
            </div>
          </section>

          <section className="app-panel rounded-[1.6rem] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Selection Context
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">History and usage</h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <RoleBreakdownCard count={totalFinalizedAppearances} label="Finalized appearances" />
              <RoleBreakdownCard count={totalFloatingAppearances} label="Floating appearances" />
              <RoleBreakdownCard count={coreAppearances} label="Core appearances" />
              <RoleBreakdownCard count={supportAppearances + developmentAppearances + floatAppearances} label="Non-core appearances" />
            </div>

            <div className="mt-5 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Latest finalized appearance</p>
              <p className="mt-2 text-sm leading-7 app-copy-soft">
                {lastFinalizedAppearance
                  ? `${formatDate(lastFinalizedAppearance.selection.match.startsAt)} · ${lastFinalizedAppearance.targetTeamNameSnapshot} vs. ${lastFinalizedAppearance.selection.match.opponent} · ${formatSelectionRole(lastFinalizedAppearance.roleType)}`
                  : "No finalized appearance history yet."}
              </p>
            </div>

            <div className="mt-5 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Recent pattern</p>
              {finalizedHistory.length > 0 ? (
                <div className="mt-3 flex flex-col gap-3">
                  {finalizedHistory.slice(0, 5).map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.16)] px-4 py-3"
                    >
                      <p className="text-sm font-medium text-zinc-100">
                        {formatDate(entry.selection.match.startsAt)} · {entry.targetTeamNameSnapshot}
                      </p>
                      <p className="mt-1 text-sm app-copy-soft">
                        {entry.selection.match.opponent} · {formatSelectionRole(entry.roleType)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm app-copy-soft">No finalized selections recorded for this player yet.</p>
              )}
            </div>
          </section>
        </section>

        <section className="app-panel-raised rounded-[1.6rem] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Player Actions
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Status and registry controls</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <form action={toggleAction}>
                <button
                  className="h-10 rounded-full border app-hairline px-4 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
                  type="submit"
                >
                  {player.active ? "Set inactive" : "Set active"}
                </button>
              </form>
              <form action={removeAction}>
                <button
                  className="h-10 rounded-full border border-[rgba(185,128,119,0.35)] px-4 text-sm font-medium text-[#e6b1aa] hover:bg-[rgba(185,128,119,0.12)]"
                  type="submit"
                >
                  Remove player
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="app-panel rounded-[1.6rem] p-5">
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Edit Lane
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Edit player record</h2>
            <p className="mt-1 text-sm leading-6 app-copy-soft">
              Update the profile, positions, availability, floating permissions, and attribute
              ratings while keeping the read-only profile context above.
            </p>
          </div>

          <PlayerEditorForm
            action={saveAction}
            cancelHref="/players"
            player={player}
            submitLabel="Save changes"
            teams={teams}
          />
        </section>
      </div>
    </main>
  );
}
