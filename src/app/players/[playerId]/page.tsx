import Link from "next/link";
import { notFound } from "next/navigation";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { removePlayerAction, togglePlayerActiveAction, updatePlayerAction } from "@/app/players/actions";
import { PlayerEditorForm, PlayerSummaryCard } from "@/components/players/player-editor-form";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatSelectionRole, isFloatingSelectionRole } from "@/lib/match-utils";
import { getPlayerSelectionInvolvement } from "@/lib/players/get-player-selection-involvement";
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

function formatRoleCount(history: Array<{ role: SelectionRole }>, roleType: SelectionRole): number {
  return history.filter((entry) => entry.role === roleType).length;
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

  const [player, teams, orderedPlayerIds, finalizedHistory, savedInvolvementSnapshots, movementHistory, recentExplanationsRaw] = await Promise.all([
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
    db.selection.findMany({
      where: { playerId, status: SelectionStatus.FINALIZED },
      select: { id: true, role: true, match: { select: { id: true, opponent: true, startsAt: true } } },
      orderBy: [{ match: { startsAt: "desc" } }],
    }),
    db.selection.findMany({
      where: { playerId },
      select: {
        createdAt: true,

        id: true,
        match: {
          select: {
            id: true,
            opponent: true,
            startsAt: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
        matchId: true,
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        role: true,
        status: true,
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
    }),
    db.movementLedger.findMany({
      where: { playerId },
      include: {
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { id: true, name: true } } } },
        fromTeam: { select: { id: true, name: true } },
        toTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
    db.selection.findMany({
      where: { playerId },
      select: {
        id: true,
        role: true,
        explanation: true,
        overrideReason: true,
        match: { select: { id: true, opponent: true, startsAt: true, team: { select: { name: true } } } },
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
    }),
  ]);

  const recentExplanations = recentExplanationsRaw.filter(
    (sel) => sel.explanation !== null || sel.overrideReason !== null,
  ).slice(0, 10);

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
    isFloatingSelectionRole(entry.role),
  ).length;
  const coreAppearances = formatRoleCount(finalizedHistory, SelectionRole.CORE);
  const supportAppearances = formatRoleCount(finalizedHistory, SelectionRole.SUPPORT);
  const developmentAppearances = formatRoleCount(finalizedHistory, SelectionRole.DEVELOPMENT);
  const lastFinalizedAppearance = finalizedHistory[0] ?? null;
  const savedInvolvement = getPlayerSelectionInvolvement(savedInvolvementSnapshots);
  const draftInvolvement = savedInvolvement
    .filter((entry) => entry.status === SelectionStatus.DRAFT)
    .sort((left, right) => left.matchStartsAt.getTime() - right.matchStartsAt.getTime());
  const finalizedInvolvement = savedInvolvement
    .filter((entry) => entry.status === SelectionStatus.FINALIZED)
    .sort((left, right) => right.matchStartsAt.getTime() - left.matchStartsAt.getTime());
  const involvementPreview = [...draftInvolvement, ...finalizedInvolvement];
  const nextFixture = involvementPreview[0] ?? null;
  const currentSelectionMessage =
    nextFixture === null
      ? "No current saved assignment exists for this player."
      : nextFixture.status === SelectionStatus.DRAFT
        ? `Next saved touchpoint is a draft on ${formatDate(nextFixture.matchStartsAt)} for ${nextFixture.teamName}.`
        : `Latest locked touchpoint is ${formatDate(nextFixture.matchStartsAt)} for ${nextFixture.teamName}.`;

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
                <p className="mt-3 max-w-3xl text-sm app-copy-soft">
                  Scan the player, then change the record.
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
                    <p className="mt-4 text-sm app-copy-soft">Built from the tracked ratings.</p>
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
                  label="Rotation eligibility"
                  value={player.nonRotatable ? "Non-rotatable" : "Eligible for rotation"}
                />
                <SnapshotCard
                  label="Planning flags"
                  value={(() => {
                    const flags: string[] = [];
                    if (player.nonRotatable) flags.push("Non-rotatable");
                    if (player.reducedMatchLoadAllowed) flags.push("Reduced load");
                    if (player.supportNoShowCount > 0) flags.push(player.supportNoShowCount + " no-show(s)");
                    if (player.supportSuitability && player.supportSuitability !== "neutral") flags.push("Support " + player.supportSuitability);
                    if (player.developmentReadiness && player.developmentReadiness !== "neutral") flags.push("Dev " + player.developmentReadiness);
                    return flags.length > 0 ? flags.join(" · ") : "No special flags";
                  })()}
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

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="app-panel rounded-[1.6rem] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Availability
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Current status and history</h2>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-sm font-semibold text-zinc-100">Current availability</p>
                <p className="mt-2 text-sm app-copy-soft">
                  {formatAvailabilityStatus(player.currentAvailability)}
                </p>
              </div>
              <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-sm font-semibold text-zinc-100">Registry status</p>
                <p className="mt-2 text-sm app-copy-soft">
                  {player.active ? "Active" : "Inactive"}
                </p>
              </div>
            </div>
          </section>

          <section className="app-panel rounded-[1.6rem] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Rotation Status
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Active restrictions and planning badges</h2>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {player.nonRotatable && (
                <div className="rounded-[1.4rem] border border-[rgba(208,176,127,0.24)] bg-[rgba(208,176,127,0.08)] p-4">
                  <p className="text-sm font-semibold text-zinc-100">Non-rotatable</p>
                  <p className="mt-1 text-sm app-copy-soft">This player cannot be rotated out of core matches.</p>
                </div>
              )}
              {player.reducedMatchLoadAllowed && (
                <div className="rounded-[1.4rem] border border-[rgba(178,140,219,0.24)] bg-[rgba(178,140,219,0.08)] p-4">
                  <p className="text-sm font-semibold text-zinc-100">Reduced match load</p>
                  <p className="mt-1 text-sm app-copy-soft">This player may be dropped for load management.</p>
                </div>
              )}
              {player.supportSuitability && player.supportSuitability !== "neutral" && (
                <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                  <p className="text-sm font-semibold text-zinc-100">Support suitability: {player.supportSuitability}</p>
                  <p className="mt-1 text-sm app-copy-soft">Rating for support role assignments.</p>
                </div>
              )}
              {player.developmentReadiness && player.developmentReadiness !== "neutral" && (
                <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                  <p className="text-sm font-semibold text-zinc-100">Development readiness: {player.developmentReadiness}</p>
                  <p className="mt-1 text-sm app-copy-soft">Rating for development exposure assignments.</p>
                </div>
              )}
              {player.supportNoShowCount > 0 && (
                <div className="rounded-[1.4rem] border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] p-4">
                  <p className="text-sm font-semibold text-zinc-100">Support no-shows: {player.supportNoShowCount}</p>
                  <p className="mt-1 text-sm app-copy-soft">Previous instances of being selected for support but not attending.</p>
                </div>
              )}
              {!player.nonRotatable && !player.reducedMatchLoadAllowed && (!player.supportSuitability || player.supportSuitability === "neutral") && (!player.developmentReadiness || player.developmentReadiness === "neutral") && player.supportNoShowCount === 0 && (
                <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                  <p className="text-sm app-copy-soft">No active restrictions or planning badges.</p>
                </div>
              )}
            </div>
          </section>
        </section>

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
                <p className="mt-2 text-sm app-copy-soft">
                  {player.primaryPosition} is the leading role, backed by {player.secondaryPosition ?? "no secondary position"} and {player.tertiaryPosition ?? "no tertiary position"}.
                </p>
              </div>
              <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-sm font-semibold text-zinc-100">Availability context</p>
                <p className="mt-2 text-sm app-copy-soft">
                  Registry status is {player.active ? "active" : "inactive"} and the current
                  availability flag is {formatAvailabilityStatus(player.currentAvailability).toLowerCase()}.
                </p>
              </div>
            </div>
          </section>

          <section className="app-panel rounded-[1.6rem] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Selection Desk
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Current saved match picture</h2>
              <p className="mt-2 text-sm app-copy-soft">
                This lane shows only the latest saved snapshot for each match, so superseded drafts and
                older saved states stay out of the conversation.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <RoleBreakdownCard count={savedInvolvement.length} label="Saved matches" />
              <RoleBreakdownCard count={draftInvolvement.length} label="Draft matches" />
              <RoleBreakdownCard count={finalizedInvolvement.length} label="Finalized matches" />
            </div>

            <div className="mt-5 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
              <p className="text-sm font-semibold text-zinc-100">Assistant note</p>
              <p className="mt-2 text-sm app-copy-soft">{currentSelectionMessage}</p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-100">Current involvement overview</p>
                  <span className="rounded-full border app-hairline px-3 py-1 text-[11px] uppercase tracking-[0.18em] app-copy-soft">
                    Latest snapshot only
                  </span>
                </div>
                {involvementPreview.length > 0 ? (
                  <div className="mt-3 flex max-h-[34rem] flex-col gap-3 overflow-y-auto pr-1">
                    {involvementPreview.map((entry, index) => (
                      <div
                        key={`${index}-${entry.matchId}-${entry.role}`}
                        className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.16)] px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Link
                            className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]"
                            href={`/selection/${entry.matchId}`}
                          >
                            {formatDate(entry.matchStartsAt)} · {entry.teamName}
                          </Link>
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
                              entry.status === SelectionStatus.FINALIZED
                                ? "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]"
                                : "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
                            }`}
                          >
                            {entry.status === SelectionStatus.FINALIZED ? "Finalized" : "Draft"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm app-copy-soft">
                          {entry.opponent} · {formatSelectionRole(entry.role)}
                        </p>
                        {entry.explanation ? (
                          <p className="mt-2 text-sm app-copy-soft">{entry.explanation}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm app-copy-soft">
                    No saved draft or finalized match involvement recorded yet.
                  </p>
                )}
              </div>

              <div className="rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
                <p className="text-sm font-semibold text-zinc-100">Locked history snapshot</p>
                <p className="mt-2 text-sm app-copy-soft">
                  {totalFinalizedAppearances} finalized appearance{totalFinalizedAppearances === 1 ? "" : "s"} ·{" "}
                  {coreAppearances} core · {supportAppearances} support · {developmentAppearances} development ·{" "}
                  {totalFloatingAppearances} float.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <SnapshotCard
                    label="Latest locked match"
                    value={
                      lastFinalizedAppearance
                        ? `${formatDate(lastFinalizedAppearance.match.startsAt)} · ${lastFinalizedAppearance.match.opponent}`
                        : "No finalized appearance history yet"
                    }
                  />
                  <SnapshotCard
                    label="Floating in locked history"
                    value={String(totalFloatingAppearances)}
                  />
                </div>

                <p className="mt-4 text-sm app-copy-soft">
                  Use this panel for long-term load, and use the current involvement lane for what is saved right now.
                </p>
              </div>
            </div>

          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="app-panel rounded-[1.6rem] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Explanations
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Why this player was selected or dropped</h2>
              <p className="mt-2 text-sm app-copy-soft">Per-selection explanations and override reasons for this player.</p>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {recentExplanations.length > 0 ? (
                recentExplanations.map((sel) => (
                  <div key={sel.id} className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]"
                        href={`/selection/${sel.match.id}`}
                      >
                        {formatDate(sel.match.startsAt)} · {sel.match.team.name} vs. {sel.match.opponent}
                      </Link>
                      <span className="rounded-full border app-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] app-copy-muted">
                        {formatSelectionRole(sel.role)}
                      </span>
                    </div>
                    {sel.explanation && (
                      <p className="mt-2 text-sm app-copy-soft">{typeof sel.explanation === "string" ? sel.explanation : JSON.stringify(sel.explanation)}</p>
                    )}
                    {sel.overrideReason && (
                      <p className="mt-1 text-xs text-[var(--warning)]">
                        Override: {sel.overrideReason}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 text-sm app-copy-soft">
                  No selection explanations recorded for this player yet.
                </div>
              )}
            </div>
          </section>

          <section className="app-panel rounded-[1.6rem] p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                Movement History
              </p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-50">Cross-team movement ledger</h2>
              <p className="mt-2 text-sm app-copy-soft">Shows when and why this player moved between teams for support, squad repair, or development.</p>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {movementHistory.length > 0 ? (
                movementHistory.map((entry) => (
                  <div key={entry.id} className="rounded-xl border app-hairline bg-[rgba(0,0,0,0.14)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Link
                        className="text-sm font-medium text-zinc-100 hover:text-[var(--accent-strong)]"
                        href={`/selection/${entry.matchId}`}
                      >
                        {formatDate(entry.match.startsAt)} · {entry.match.team.name} vs. {entry.match.opponent}
                      </Link>
                      <span className="rounded-full border app-hairline px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] app-copy-muted">
                        {formatSelectionRole(entry.role)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm app-copy-soft">
                      {entry.reason ?? "No reason recorded"}
                    </p>
                    <p className="mt-1 text-xs app-copy-muted">
                      {entry.fromTeam.name} → {entry.toTeam.name}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4 text-sm app-copy-soft">
                  No cross-team movement recorded for this player yet.
                </div>
              )}
            </div>
          </section>
        </section>

        <section className="app-panel rounded-[1.6rem] p-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
              Coach Notes
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Internal notes</h2>
            <p className="mt-2 text-sm app-copy-soft">Coach-visible internal notes about this player. These notes are not included in parent or player exports.</p>
          </div>

          <div className="mt-5 rounded-[1.4rem] border app-hairline bg-[rgba(255,255,255,0.025)] p-4">
            {player.notes ? (
              <p className="text-sm text-zinc-100 whitespace-pre-wrap">{player.notes}</p>
            ) : (
              <p className="text-sm app-copy-soft">No internal notes recorded for this player. Add notes through the Edit Lane below.</p>
            )}
          </div>
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
            <p className="mt-1 text-sm app-copy-soft">
              Update the profile, availability, rotation settings, and ratings here.
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