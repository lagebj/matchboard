import { NextRequest, NextResponse } from "next/server";
import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const planningPeriodId = searchParams.get("planningPeriodId");
  const format = getExportFormat(searchParams.get("format"));
  const visibility = getVisibilityMode(searchParams.get("visibility"));

  if (!planningPeriodId) {
    return NextResponse.json({ error: "planningPeriodId required" }, { status: 400 });
  }

  const planningPeriod = await db.planningPeriod.findUnique({
    where: { id: planningPeriodId },
    select: { name: true, startDate: true, endDate: true },
  });

  if (!planningPeriod) {
    return NextResponse.json({ error: "Planning period not found" }, { status: 404 });
  }

  const matchRounds = await db.matchRound.findMany({
    where: { planningPeriodId, status: "FINALIZED" },
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
      overrideReason: true,
      explanation: true,
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
    position: string;
    overrideReason: string | null;
    explanation: string | null;
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
    position: s.player.primaryPosition,
    overrideReason: s.overrideReason,
    explanation: s.explanation
      ? typeof s.explanation === "string"
        ? s.explanation
        : JSON.stringify(s.explanation)
      : null,
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
    };
    if (s.role === "CORE") existing.coreMatches++;
    else if (s.role === "SUPPORT") existing.supportMatches++;
    else if (s.role === "DEVELOPMENT") existing.developmentMatches++;
    else if (s.role === "BACKFILL") existing.backfillMatches++;
    else if (s.role === "DOUBLE_LOAD") existing.doubleLoadRounds++;
    playerStats.set(key, existing);
  }
  for (const [, stats] of playerStats) {
    stats.roundsPlayed = stats.coreMatches + stats.supportMatches + stats.developmentMatches + stats.backfillMatches;
    if (stats.doubleLoadRounds > 0) stats.roundsPlayed -= stats.doubleLoadRounds;
  }

  const statsRows = [...playerStats.values()].sort((a, b) =>
    a.coreTeam.localeCompare(b.coreTeam) || a.playerName.localeCompare(b.playerName),
  );

  if (format === "json") {
    const data = {
      planningPeriod: planningPeriod.name,
      startDate: formatDate(planningPeriod.startDate),
      endDate: formatDate(planningPeriod.endDate),
      finalizedRounds: roundIds.length,
      visibility,
      selections: isParent ? selectionRows.map(({ overrideReason, explanation, sourceTeam, ...rest }) => rest) : selectionRows,
      movements: isParent ? movementRows.map(({ fromTeam, toTeam, role, ...rest }) => rest) : movementRows,
      playerStats: isParent
        ? statsRows.map(({ coreMatches, supportMatches, developmentMatches, backfillMatches, doubleLoadRounds, ...rest }) => rest)
        : statsRows,
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

    sections.push(`# ${planningPeriod.name} — Season Export`);
    sections.push(`Period: ${formatDate(planningPeriod.startDate)} — ${formatDate(planningPeriod.endDate)}`);
    sections.push(`Finalized rounds: ${roundIds.length}`);
    sections.push("");

    sections.push("## Selections");
    if (isParent) {
      sections.push(["Round", "Date", "Team", "Home/Away", "Opponent", "Player", "Position"].map(escapeCsv).join(","));
      for (const r of selectionRows) {
        sections.push([r.round, r.date, r.team, r.homeOrAway, r.opponent, r.playerName, r.position].map(escapeCsv).join(","));
      }
    } else {
      sections.push(["Round", "Date", "Team", "Home/Away", "Opponent", "Player", "Source Team", "Role", "Position", "Override Reason", "Explanation"].map(escapeCsv).join(","));
      for (const r of selectionRows) {
        sections.push([r.round, r.date, r.team, r.homeOrAway, r.opponent, r.playerName, r.sourceTeam, r.role, r.position, r.overrideReason ?? "", r.explanation ?? ""].map(escapeCsv).join(","));
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
      sections.push(["Player", "Team", "Rounds", "Core", "Support", "Development", "Squad Repair", "Double-Load"].map(escapeCsv).join(","));
      for (const s of statsRows) {
        sections.push([s.playerName, s.coreTeam, String(s.roundsPlayed), String(s.coreMatches), String(s.supportMatches), String(s.developmentMatches), String(s.backfillMatches), String(s.doubleLoadRounds)].map(escapeCsv).join(","));
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
    lines.push(`${planningPeriod.name}`);
    lines.push(`Period: ${formatDate(planningPeriod.startDate)} — ${formatDate(planningPeriod.endDate)}`);
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
            lines.push(`    ${r.playerName} (${r.sourceTeam} → ${r.team}, ${r.role}${r.position ? `, ${r.position}` : ""})`);
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
      lines.push("Player | Team | Rounds | Core | Support | Dev | Repair | 2x-Load");
      for (const s of statsRows) {
        lines.push(`${s.playerName} | ${s.coreTeam} | ${s.roundsPlayed} | ${s.coreMatches} | ${s.supportMatches} | ${s.developmentMatches} | ${s.backfillMatches} | ${s.doubleLoadRounds}`);
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
  md.push(`# ${planningPeriod.name} — Season Export`);
  md.push(`**Period:** ${formatDate(planningPeriod.startDate)} — ${formatDate(planningPeriod.endDate)}`);
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
        md.push("| Player | Source | Role | Position | Override |");
        md.push("| --- | --- | --- | --- | --- |");
        for (const r of matchRows) {
          md.push(`| ${r.playerName} | ${r.sourceTeam} | ${r.role} | ${r.position} | ${r.overrideReason ?? "—"} |`);
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
    md.push("| Player | Team | Rounds | Core | Support | Development | Squad Repair | Double-Load |");
    md.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const s of statsRows) {
      md.push(`| ${s.playerName} | ${s.coreTeam} | ${s.roundsPlayed} | ${s.coreMatches} | ${s.supportMatches} | ${s.developmentMatches} | ${s.backfillMatches} | ${s.doubleLoadRounds} |`);
    }
  }

  return new Response(md.join("\n"), {
    headers: {
      "Content-Disposition": `attachment; filename="${buildFilename("md")}"`,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}