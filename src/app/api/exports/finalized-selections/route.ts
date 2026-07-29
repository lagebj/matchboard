import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";

type ExportFormat = "csv" | "json" | "txt" | "md";
type VisibilityMode = "coach" | "parent";

function getExportFormat(value: string | null): ExportFormat {
  if (value === "json" || value === "txt" || value === "md") {
    return value;
  }
  return "csv";
}

function getVisibilityMode(value: string | null): VisibilityMode {
  if (value === "parent") {
    return "parent";
  }
  return "coach";
}

function buildFilename(format: ExportFormat) {
  const today = new Date().toISOString().slice(0, 10);
  return `finalised-match-selections-${today}.${format}`;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

type CoachRow = {
  date: string;
  team: string;
  homeOrAway: string;
  opponent: string;
  playerName: string;
  sourceTeam: string;
  role: string;
  overrideReason: string | null;
  explanation: string | null;
  matchdayResponsibility: string | null;
};

type ParentRow = {
  date: string;
  team: string;
  homeOrAway: string;
  opponent: string;
  playerName: string;
};

export async function GET(request: Request) {
  await requireCoachAccess();
  const rl = rateLimit("exports:finalized-selections", 5, 60_000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait." }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  const url = new URL(request.url);
  const format = getExportFormat(url.searchParams.get("format"));
  const visibility = getVisibilityMode(url.searchParams.get("visibility"));

  const finalizedSelections = await db.selection.findMany({
    where: { status: SelectionStatus.FINALIZED },
    include: {
      match: {
        include: {
          team: { select: { name: true } },
        },
      },
      player: {
        select: {
          firstName: true,
          lastName: true,
          reducedMatchLoadAllowed: true,
          supportSuitability: true,
          developmentReadiness: true,
          coreTeam: { select: { name: true } },
        },
      },
    },
    orderBy: [{ match: { startsAt: "desc" } }],
  });

  const isParent = visibility === "parent";

  if (format === "json") {
    if (isParent) {
      const groupedByMatch = new Map<string, ParentRow[]>();

      for (const selection of finalizedSelections) {
        const matchKey = selection.matchId;
        if (!groupedByMatch.has(matchKey)) {
          groupedByMatch.set(matchKey, []);
        }
        groupedByMatch.get(matchKey)!.push({
          date: formatDate(selection.match.startsAt),
          team: selection.match.team.name,
          homeOrAway: formatMatchVenue(selection.match.homeAway),
          opponent: selection.match.opponent,
          playerName: selection.player.lastName
            ? `${selection.player.firstName} ${selection.player.lastName}`
            : selection.player.firstName,
        });
      }

      const matches = Array.from(groupedByMatch.entries()).map(([matchId, playerRows]) => ({
        matchId,
        date: playerRows[0].date,
        team: playerRows[0].team,
        homeOrAway: playerRows[0].homeOrAway,
        opponent: playerRows[0].opponent,
        players: playerRows.map((r) => r.playerName),
      }));

      return new Response(JSON.stringify({ visibility: "parent", matches }, null, 2), {
        headers: {
          "Content-Disposition": `attachment; filename="${buildFilename("json")}"`,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    const coachRows: CoachRow[] = finalizedSelections.map((selection) => ({
      date: formatDate(selection.match.startsAt),
      team: selection.match.team.name,
      homeOrAway: formatMatchVenue(selection.match.homeAway),
      opponent: selection.match.opponent,
      playerName: selection.player.lastName
        ? `${selection.player.firstName} ${selection.player.lastName}`
        : selection.player.firstName,
      sourceTeam: selection.player.coreTeam?.name ?? "",
      role: formatSelectionRole(selection.role),
      overrideReason: selection.overrideReason ?? null,
      explanation: selection.explanation
        ? typeof selection.explanation === "string"
          ? selection.explanation
          : JSON.stringify(selection.explanation)
        : null,
      matchdayResponsibility: selection.matchdayResponsibility ?? null,
    }));

    return new Response(JSON.stringify({ visibility: "coach", selections: coachRows }, null, 2), {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename("json")}"`,
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  if (format === "csv") {
    if (isParent) {
      const rows = finalizedSelections.map((selection) => ({
        date: formatDate(selection.match.startsAt),
        team: selection.match.team.name,
        homeOrAway: formatMatchVenue(selection.match.homeAway),
        opponent: selection.match.opponent,
        playerName: selection.player.lastName
          ? `${selection.player.firstName} ${selection.player.lastName}`
          : selection.player.firstName,
      }));

      const body = [
        ["Date", "Team", "Home/Away", "Opponent", "Player"]
          .map(escapeCsv)
          .join(","),
        ...rows.map((row) =>
          [row.date, row.team, row.homeOrAway, row.opponent, row.playerName]
            .map(escapeCsv)
            .join(","),
        ),
      ].join("\n");

      return new Response(body, {
        headers: {
          "Content-Disposition": `attachment; filename="${buildFilename("csv")}"`,
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    const rows = finalizedSelections.map((selection) => ({
      date: formatDate(selection.match.startsAt),
      team: selection.match.team.name,
      homeOrAway: formatMatchVenue(selection.match.homeAway),
      opponent: selection.match.opponent,
      playerName: selection.player.lastName
        ? `${selection.player.firstName} ${selection.player.lastName}`
        : selection.player.firstName,
      sourceTeam: selection.player.coreTeam?.name ?? "",
      role: formatSelectionRole(selection.role),
      overrideReason: selection.overrideReason ?? "",
      explanation: selection.explanation
        ? typeof selection.explanation === "string"
          ? selection.explanation
          : JSON.stringify(selection.explanation)
        : "",
      matchdayResponsibility: selection.matchdayResponsibility ?? "",
    }));

    const body = [
      ["Date", "Team", "Home/Away", "Opponent", "Player", "Source Team", "Role", "Override Reason", "Explanation", "Responsibility"]
        .map(escapeCsv)
        .join(","),
      ...rows.map((row) =>
        [row.date, row.team, row.homeOrAway, row.opponent, row.playerName, row.sourceTeam, row.role, row.overrideReason, row.explanation, row.matchdayResponsibility]
          .map(escapeCsv)
          .join(","),
      ),
    ].join("\n");

    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename("csv")}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  if (format === "txt") {
    if (isParent) {
      const byMatch = new Map<string, typeof finalizedSelections>();
      for (const s of finalizedSelections) {
        if (!byMatch.has(s.matchId)) byMatch.set(s.matchId, []);
        byMatch.get(s.matchId)!.push(s);
      }

      const body = byMatch.size > 0
        ? [...byMatch.values()].map((matchSelections) => {
            const m = matchSelections[0].match;
            const header = `${m.team.name} vs. ${m.opponent}\n${formatDate(m.startsAt)} · ${formatMatchVenue(m.homeAway)}`;
            const players = matchSelections.map((s) =>
              `- ${s.player.firstName}${s.player.lastName ? ` ${s.player.lastName}` : ""}`,
            ).join("\n");
            return `${header}\n${players}`;
          }).join("\n\n")
        : "No finalised selections available.";

      return new Response(body, {
        headers: {
          "Content-Disposition": `attachment; filename="${buildFilename("txt")}"`,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const body = finalizedSelections.length
      ? finalizedSelections.map((s) => {
          const header = `${s.match.team.name} vs. ${s.match.opponent}\n${formatDate(s.match.startsAt)} · ${formatMatchVenue(s.match.homeAway)}`;
          const player = `- ${s.player.firstName}${s.player.lastName ? ` ${s.player.lastName}` : ""} (${s.player.coreTeam?.name ?? ""}, ${formatSelectionRole(s.role)}${s.matchdayResponsibility ? `, ${s.matchdayResponsibility}` : ""})`;
          const override = s.overrideReason ? `\n  Override: ${s.overrideReason}` : "";
          const explanation = s.explanation ? `\n  Explanation: ${typeof s.explanation === "string" ? s.explanation : JSON.stringify(s.explanation)}` : "";
          return `${header}\n${player}${override}${explanation}`;
        }).join("\n\n")
      : "No finalised selections available.";

    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename("txt")}"`,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  // markdown format
  if (isParent) {
    const byMatch = new Map<string, typeof finalizedSelections>();
    for (const s of finalizedSelections) {
      if (!byMatch.has(s.matchId)) byMatch.set(s.matchId, []);
      byMatch.get(s.matchId)!.push(s);
    }

    const body = byMatch.size > 0
      ? [...byMatch.values()].map((matchSelections) => {
          const m = matchSelections[0].match;
          const heading = `## ${m.team.name} vs. ${m.opponent}`;
          const meta = `${formatDate(m.startsAt)} | ${formatMatchVenue(m.homeAway)}`;
          const table = [
            "| Player |",
            "| --- |",
            ...matchSelections.map((s) => `| ${s.player.firstName}${s.player.lastName ? ` ${s.player.lastName}` : ""} |`),
          ].join("\n");
          return `${heading}\n\n${meta}\n\n${table}`;
        }).join("\n\n")
      : "No finalised selections available.";

    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${buildFilename("md")}"`,
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  }

  const body = finalizedSelections.length
    ? finalizedSelections.map((s) => {
        const heading = `## ${s.match.team.name} vs. ${s.match.opponent}`;
        const meta = `${formatDate(s.match.startsAt)} | ${formatMatchVenue(s.match.homeAway)}`;
        const table = [
          "| Player | Source Team | Role | Responsibility | Override | Explanation |",
          "| --- | --- | --- | --- | --- | --- |",
          `| ${s.player.firstName}${s.player.lastName ? ` ${s.player.lastName}` : ""} | ${s.player.coreTeam?.name ?? ""} | ${formatSelectionRole(s.role)} | ${s.matchdayResponsibility ?? "—"} | ${s.overrideReason ?? "—"} | ${s.explanation ? (typeof s.explanation === "string" ? s.explanation : JSON.stringify(s.explanation)) : "—"} |`,
        ].join("\n");
        return `${heading}\n\n${meta}\n\n${table}`;
      }).join("\n\n")
    : "No finalised selections available.";

  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${buildFilename("md")}"`,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}