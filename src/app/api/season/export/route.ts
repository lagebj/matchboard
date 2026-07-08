import { NextRequest, NextResponse } from "next/server";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole, formatReadinessSignalType } from "@/lib/match-utils";
import { READINESS_VALUE_LABELS, type ReadinessSignalValue } from "@/lib/coaching/types";
import { sanitizeSelectionForParent as _sanitizeSelection, sanitizeMovementForParent as _sanitizeMovement, sanitizePlayerStatsForParent as _sanitizeStats } from "@/lib/export/parent-safe-filter";

type ExportFormat = "csv" | "json" | "txt" | "md";
type VisibilityMode = "coach" | "parent";

function getExportFormat(value: string | null): ExportFormat {
  if (value === "json" || value === "txt" || value === "md") return value;
  return "csv";
}

function getVisibilityMode(value: string | null): VisibilityMode {
  return value === "parent" ? "parent" : "coach";
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function buildFilename(format: ExportFormat) {
  const today = new Date().toISOString().slice(0, 10);
  return `season-export-${today}.${format}`;
}

// Opponent encounter observations are intentionally excluded from all exports.
// Per domain rules: opponent observation data must not appear in parent-facing
// exports or external AI payloads. If observation data is ever added here,
// it must be filtered through sanitizeSelectionForParent and excluded from
// parent visibility mode entirely.

export async function GET(request: NextRequest) {
  await requireCoachAccess();
  const { searchParams } = request.nextUrl;
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const format = getExportFormat(searchParams.get("format"));
  const visibility = getVisibilityMode(searchParams.get("visibility"));

  if (!leagueSeasonId) {
    return NextResponse.json({ error: "leagueSeasonId required" }, { status: 400 });
  }

  const leagueSeason = await db.leagueSeason.findUnique({
    where: { id: leagueSeasonId },
    select: { name: true, startDate: true, endDate: true },
  });

  if (!leagueSeason) {
    return NextResponse.json({ error: "League season not found" }, { status: 404 });
  }

  const matchRounds = await db.matchRound.findMany({
    where: { leagueSeasonId, status: "FINALIZED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const roundIds = matchRounds.map((r) => r.id);

  const selections = await db.selection.findMany({
    where: {
      matchRoundId: { in: roundIds },
      status: SelectionStatus.FINALIZED,
      player: { removedAt: null, active: true },
    },
    select: {
      matchRoundId: true,
      matchId: true,
      playerId: true,
      role: true,
      controlledDoubleLoad: true,
      overrideReasonCategory: true,
      overrideReasonDetail: true,
      explanation: true,
      matchdayResponsibility: true,
      player: {
        select: {
          firstName: true,
          lastName: true,
          primaryPosition: true,
          coreTeam: { select: { name: true } },
        },
      },
      match: {
        select: {
          startsAt: true,
          homeAway: true,
          opponent: true,
          team: { select: { name: true } },
        },
      },
    },
    orderBy: [{ match: { startsAt: "asc" } }, { player: { firstName: "asc" } }],
  });

  const movements = await db.movementLedger.findMany({
    where: {
      matchRoundId: { in: roundIds },
      isDraft: false,
    },
    select: {
      matchRoundId: true,
      matchId: true,
      playerId: true,
      role: true,
      fromTeamId: true,
      toTeamId: true,
      fromTeam: { select: { name: true } },
      toTeam: { select: { name: true } },
      player: { select: { firstName: true, lastName: true } },
      match: { select: { startsAt: true, opponent: true, homeAway: true, team: { select: { name: true } } } },
    },
    orderBy: { match: { startsAt: "asc" } },
  });

  const readinessSignals = await db.playerReadinessSignal.findMany({
    where: {
      playerId: { in: [...new Set(selections.map((s) => s.playerId))] },
    },
    select: {
      playerId: true,
      signalType: true,
      value: true,
    },
  });

  const readinessByPlayer = new Map<string, string[]>();
  for (const rs of readinessSignals) {
    const existing = readinessByPlayer.get(rs.playerId) ?? [];
    existing.push(`${formatReadinessSignalType(rs.signalType)}: ${READINESS_VALUE_LABELS[rs.value as ReadinessSignalValue] ?? rs.value}`);
    readinessByPlayer.set(rs.playerId, existing);
  }

  const isParent = visibility === "parent";

  type SelectionRow = {
    round: string;
    date: string;
    team: string;
    homeOrAway: string;
    opponent: string;
    playerName: string;
    sourceTeam: string;
    role: string;
    controlledDoubleLoad: boolean;
    position: string;
    overrideReasonCategory: string | null;
    overrideReasonDetail: string | null;
    explanation: string | null;
    matchdayResponsibility: string | null;
  };

  type MovementRow = {
    round: string;
    date: string;
    playerName: string;
    direction: string;
    fromTeam: string;
    toTeam: string;
    role: string;
  };

  const selectionRows: SelectionRow[] = selections.map((s) => ({
    round: matchRounds.find((r) => r.id === s.matchRoundId)?.name ?? "",
    date: formatDate(s.match.startsAt),
    team: s.match.team.name,
    homeOrAway: formatMatchVenue(s.match.homeAway),
    opponent: s.match.opponent,
    playerName: s.player.lastName ? `${s.player.firstName} ${s.player.lastName}` : s.player.firstName,
    sourceTeam: s.player.coreTeam?.name ?? "",
    role: formatSelectionRole(s.role),
    controlledDoubleLoad: s.controlledDoubleLoad ?? false,
    position: s.player.primaryPosition,
    overrideReasonCategory: s.overrideReasonCategory ?? null,
    overrideReasonDetail: s.overrideReasonDetail ?? null,
    explanation: s.explanation
      ? typeof s.explanation === "string"
        ? s.explanation
        : JSON.stringify(s.explanation)
      : null,
    matchdayResponsibility: s.matchdayResponsibility ?? null,
  }));

  const movementRows: MovementRow[] = movements.map((m) => ({
    round: matchRounds.find((r) => r.id === m.matchRoundId)?.name ?? "",
    date: formatDate(m.match.startsAt),
    playerName: m.player.lastName ? `${m.player.firstName} ${m.player.lastName}` : m.player.firstName,
    direction: `${m.fromTeam.name} → ${m.toTeam.name}`,
    fromTeam: m.fromTeam.name,
    toTeam: m.toTeam.name,
    role: formatSelectionRole(m.role),
  }));

  type StatsRow = {
    playerName: string;
    coreTeam: string;
    roundsPlayed: number;
    coreMatches: number;
    supportMatches: number;
    developmentMatches: number;
    backfillMatches: number;
    doubleLoadRounds: number;
    readinessSignals: string[];
  };

  const playerStats = new Map<string, StatsRow>();
  for (const s of selections) {
    const key = s.playerId;
    const name = s.player.lastName ? `${s.player.firstName} ${s.player.lastName}` : s.player.firstName;
    const team = s.player.coreTeam?.name ?? "";
    const existing = playerStats.get(key) ?? {
      playerName: name,
      coreTeam: team,
      roundsPlayed: 0,
      coreMatches: 0,
      supportMatches: 0,
      developmentMatches: 0,
      backfillMatches: 0,
      doubleLoadRounds: 0,
      readinessSignals: readinessByPlayer.get(key) ?? [],
    };
    if (s.role === "CORE") existing.coreMatches++;
    else if (s.role === "SUPPORT") existing.supportMatches++;
    else if (s.role === "DEVELOPMENT") existing.developmentMatches++;
    else if (s.role === "BACKFILL") existing.backfillMatches++;
    if (s.controlledDoubleLoad) existing.doubleLoadRounds++;
    playerStats.set(key, existing);
  }
  for (const [, stats] of playerStats) {
    stats.roundsPlayed = stats.coreMatches + stats.supportMatches + stats.developmentMatches + stats.backfillMatches;
  }

  const statsRows = [...playerStats.values()].sort((a, b) =>
    a.coreTeam.localeCompare(b.coreTeam) || a.playerName.localeCompare(b.playerName),
  );

  if (format === "json") {
    const data = {
      leagueSeason: leagueSeason.name,
      startDate: formatDate(leagueSeason.startDate),
      endDate: formatDate(leagueSeason.endDate),
      finalizedRounds: roundIds.length,
      visibility,
      selections: isParent ? selectionRows.map((r) => _sanitizeSelection({ ...r, overrideReasonCategory: r.overrideReasonCategory ?? undefined, overrideReasonDetail: r.overrideReasonDetail ?? undefined, explanation: r.explanation ?? undefined, controlledDoubleLoad: r.controlledDoubleLoad } as Parameters<typeof _sanitizeSelection>[0])) : selectionRows,
      movements: isParent ? movementRows.map((r): Record<string, unknown> => _sanitizeMovement({ ...r })) : movementRows,
      playerStats: isParent ? statsRows.map((r): Record<string, unknown> => _sanitizeStats({ ...r, readinessSignals: undefined, feedback: undefined, coachingIntent: undefined })) : statsRows,
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename("json")}"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  if (format === "csv") {
    const sections: string[] = [];

    sections.push(`# ${leagueSeason.name} — Season Export`);
    sections.push(`Period: ${formatDate(leagueSeason.startDate)} — ${formatDate(leagueSeason.endDate)}`);
    sections.push(`Finalized rounds: ${roundIds.length}`);
    sections.push("");

    sections.push("## Selections");
    if (isParent) {
      sections.push(["Round", "Date", "Team", "Home/Away", "Opponent", "Player", "Position"].map(escapeCsv).join(","));
      for (const r of selectionRows) {
        sections.push([r.round, r.date, r.team, r.homeOrAway, r.opponent, r.playerName, r.position].map(escapeCsv).join(","));
      }
    } else {
      sections.push(["Round", "Date", "Team", "Home/Away", "Opponent", "Player", "Source Team", "Role", "Double-Load", "Responsibility", "Position", "Override Category", "Override Detail", "Explanation"].map(escapeCsv).join(","));
      for (const r of selectionRows) {
        sections.push([r.round, r.date, r.team, r.homeOrAway, r.opponent, r.playerName, r.sourceTeam, r.role, r.controlledDoubleLoad ? "Yes" : "", r.matchdayResponsibility ?? "", r.position, r.overrideReasonCategory ?? "", r.overrideReasonDetail ?? "", r.explanation ?? ""].map(escapeCsv).join(","));
      }
    }

    sections.push("");
    sections.push("## Movement");
    if (isParent) {
      sections.push(["Round", "Date", "Player", "Direction"].map(escapeCsv).join(","));
      for (const m of movementRows) {
        sections.push([m.round, m.date, m.playerName, m.direction].map(escapeCsv).join(","));
      }
    } else {
      sections.push(["Round", "Date", "Player", "From Team", "To Team", "Role"].map(escapeCsv).join(","));
      for (const m of movementRows) {
        sections.push([m.round, m.date, m.playerName, m.fromTeam, m.toTeam, m.role].map(escapeCsv).join(","));
      }
    }

    sections.push("");
    sections.push("## Player Statistics");
    if (isParent) {
      sections.push(["Player", "Team", "Rounds", "Position"].map(escapeCsv).join(","));
      for (const s of statsRows) {
        sections.push([s.playerName, s.coreTeam, String(s.roundsPlayed), ""].map(escapeCsv).join(","));
      }
    } else {
      sections.push(["Player", "Team", "Rounds", "Core", "Support", "Development", "Squad Repair", "Double-Load", "Readiness Signals"].map(escapeCsv).join(","));
      for (const s of statsRows) {
        sections.push([s.playerName, s.coreTeam, String(s.roundsPlayed), String(s.coreMatches), String(s.supportMatches), String(s.developmentMatches), String(s.backfillMatches), String(s.doubleLoadRounds), s.readinessSignals.join("; ")].map(escapeCsv).join(","));
      }
    }

    return new Response(sections.join("\n"), {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename("csv")}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  if (format === "txt") {
    const lines: string[] = [];
    lines.push(`${leagueSeason.name}`);
    lines.push(`Period: ${formatDate(leagueSeason.startDate)} — ${formatDate(leagueSeason.endDate)}`);
    lines.push(`Finalized rounds: ${roundIds.length}`);
    lines.push("");
    lines.push("=== SQUADS ===");
    lines.push("");

    const byRound = new Map<string, SelectionRow[]>();
    for (const s of selectionRows) {
      if (!byRound.has(s.round)) byRound.set(s.round, []);
      byRound.get(s.round)!.push(s);
    }

    for (const [round, rows] of byRound) {
      lines.push(`--- ${round} ---`);
      const byMatch = new Map<string, SelectionRow[]>();
      for (const r of rows) {
        const key = `${r.team} vs ${r.opponent}`;
        if (!byMatch.has(key)) byMatch.set(key, []);
        byMatch.get(key)!.push(r);
      }
      for (const [matchKey, matchRows] of byMatch) {
        lines.push(`  ${matchKey}`);
        lines.push(`  ${matchRows[0]!.date} · ${matchRows[0]!.homeOrAway}`);
        for (const r of matchRows) {
          if (isParent) {
            lines.push(`    ${r.playerName} (${r.position})`);
          } else {
            lines.push(`    ${r.playerName} (${r.sourceTeam} → ${r.team}, ${r.role}${r.matchdayResponsibility ? `, ${r.matchdayResponsibility}` : ""}${r.controlledDoubleLoad ? ", double-load" : ""}${r.position ? `, ${r.position}` : ""})`);
          }
        }
        lines.push("");
      }
    }

    if (!isParent) {
      lines.push("");
      lines.push("=== MOVEMENT ===");
      lines.push("");
      for (const m of movementRows) {
        lines.push(`${m.round} | ${m.date} | ${m.playerName}: ${m.fromTeam} → ${m.toTeam} (${m.role})`);
      }
    }

    lines.push("");
    lines.push("=== PLAYER STATISTICS ===");
    lines.push("");
    if (isParent) {
      for (const s of statsRows) {
        lines.push(`${s.playerName} (${s.coreTeam}): ${s.roundsPlayed} round(s)`);
      }
    } else {
      lines.push("Player | Team | Rounds | Core | Support | Dev | Repair | 2x-Load | Readiness");
      for (const s of statsRows) {
        lines.push(`${s.playerName} | ${s.coreTeam} | ${s.roundsPlayed} | ${s.coreMatches} | ${s.supportMatches} | ${s.developmentMatches} | ${s.backfillMatches} | ${s.doubleLoadRounds} | ${s.readinessSignals.length > 0 ? s.readinessSignals.join(", ") : "—"}`);
      }
    }

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename("txt")}"`,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const md: string[] = [];
  md.push(`# ${leagueSeason.name} — Season Export`);
  md.push(`**Period:** ${formatDate(leagueSeason.startDate)} — ${formatDate(leagueSeason.endDate)}`);
  md.push(`**Finalized rounds:** ${roundIds.length}`);
  md.push("");

  md.push("## Squads");
  md.push("");

  const byRoundForMd = new Map<string, SelectionRow[]>();
  for (const s of selectionRows) {
    if (!byRoundForMd.has(s.round)) byRoundForMd.set(s.round, []);
    byRoundForMd.get(s.round)!.push(s);
  }

  for (const [round, rows] of byRoundForMd) {
    md.push(`### ${round}`);
    const byMatch = new Map<string, SelectionRow[]>();
    for (const r of rows) {
      const key = `${r.team} vs ${r.opponent}`;
      if (!byMatch.has(key)) byMatch.set(key, []);
      byMatch.get(key)!.push(r);
    }
    for (const [matchKey, matchRows] of byMatch) {
      md.push(`**${matchKey}** — ${matchRows[0]!.date} · ${matchRows[0]!.homeOrAway}`);
      if (isParent) {
        for (const r of matchRows) {
          md.push(`- ${r.playerName}`);
        }
      } else {
        md.push("| Player | Source | Role | Responsibility | Double-Load | Position | Override |");
        md.push("| --- | --- | --- | --- | --- | --- | --- |");
        for (const r of matchRows) {
          md.push(`| ${r.playerName} | ${r.sourceTeam} | ${r.role} | ${r.matchdayResponsibility ?? "—"} | ${r.controlledDoubleLoad ? "Yes" : "—"} | ${r.position} | ${r.overrideReasonCategory ? `${r.overrideReasonCategory}${r.overrideReasonDetail ? `: ${r.overrideReasonDetail}` : ""}` : "—"} |`);
        }
      }
      md.push("");
    }
  }

  if (!isParent) {
    md.push("## Movement");
    md.push("");
    md.push("| Round | Date | Player | From | To | Role |");
    md.push("| --- | --- | --- | --- | --- | --- |");
    for (const m of movementRows) {
      md.push(`| ${m.round} | ${m.date} | ${m.playerName} | ${m.fromTeam} | ${m.toTeam} | ${m.role} |`);
    }
    md.push("");
  }

  md.push("## Player Statistics");
  md.push("");
  if (isParent) {
    md.push("| Player | Team | Rounds |");
    md.push("| --- | --- | --- |");
    for (const s of statsRows) {
      md.push(`| ${s.playerName} | ${s.coreTeam} | ${s.roundsPlayed} |`);
    }
  } else {
    md.push("| Player | Team | Rounds | Core | Support | Development | Squad Repair | Double-Load | Readiness |");
    md.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const s of statsRows) {
      md.push(`| ${s.playerName} | ${s.coreTeam} | ${s.roundsPlayed} | ${s.coreMatches} | ${s.supportMatches} | ${s.developmentMatches} | ${s.backfillMatches} | ${s.doubleLoadRounds} | ${s.readinessSignals.length > 0 ? s.readinessSignals.join(", ") : "—"} |`);
    }
  }

  return new Response(md.join("\n"), {
    headers: {
      "Content-Disposition": `attachment; filename="${buildFilename("md")}"`,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}