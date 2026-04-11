import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue, formatSelectionRole } from "@/lib/match-utils";

type ExportFormat = "csv" | "txt" | "md";

function getExportFormat(value: string | null): ExportFormat {
  if (value === "txt" || value === "md") {
    return value;
  }

  return "csv";
}

function buildFilename(format: ExportFormat) {
  const today = new Date().toISOString().slice(0, 10);
  return `finalized-match-selections-${today}.${format}`;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = getExportFormat(url.searchParams.get("format"));

  const finalizedSelections = await db.matchSelection.findMany({
    where: {
      status: SelectionStatus.FINALIZED,
    },
    include: {
      match: {
        include: {
          targetTeam: {
            select: {
              name: true,
            },
          },
        },
      },
      players: {
        where: {
          wasManuallyRemoved: false,
        },
        include: {
          player: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          {
            player: {
              firstName: "asc",
            },
          },
          {
            player: {
              lastName: "asc",
            },
          },
        ],
      },
    },
    orderBy: [
      {
        match: {
          startsAt: "desc",
        },
      },
      {
        finalizedAt: "desc",
      },
    ],
  });

  const rows = finalizedSelections.flatMap((selection) =>
    selection.players.map((selectionPlayer) => ({
      date: formatDate(selection.match.startsAt),
      homeOrAway: formatMatchVenue(selection.match.homeOrAway),
      opponent: selection.match.opponent,
      playerName: selectionPlayer.player.lastName
        ? `${selectionPlayer.player.firstName} ${selectionPlayer.player.lastName}`
        : selectionPlayer.player.firstName,
      role: formatSelectionRole(selectionPlayer.roleType),
      sourceTeam: selectionPlayer.sourceTeamNameSnapshot,
      targetTeam: selection.match.targetTeam.name,
    })),
  );

  let body = "";
  let contentType = "text/csv; charset=utf-8";

  if (format === "csv") {
    body = [
      ["Date", "Team", "Home/Away", "Opponent", "Player", "Source Team", "Role"]
        .map(escapeCsv)
        .join(","),
      ...rows.map((row) =>
        [
          row.date,
          row.targetTeam,
          row.homeOrAway,
          row.opponent,
          row.playerName,
          row.sourceTeam,
          row.role,
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ].join("\n");
  }

  if (format === "txt") {
    contentType = "text/plain; charset=utf-8";
    body = finalizedSelections.length
      ? finalizedSelections
          .map((selection) => {
            const header = [
              `${selection.match.targetTeam.name} vs. ${selection.match.opponent}`,
              `${formatDate(selection.match.startsAt)} · ${formatMatchVenue(selection.match.homeOrAway)}`,
            ].join("\n");
            const players = selection.players.length
              ? selection.players
                  .map((player) => {
                    const name = player.player.lastName
                      ? `${player.player.firstName} ${player.player.lastName}`
                      : player.player.firstName;

                    return `- ${name} (${player.sourceTeamNameSnapshot}, ${formatSelectionRole(player.roleType)})`;
                  })
                  .join("\n")
              : "- No selected players";

            return `${header}\n${players}`;
          })
          .join("\n\n")
      : "No finalized selections available.";
  }

  if (format === "md") {
    contentType = "text/markdown; charset=utf-8";
    body = finalizedSelections.length
      ? finalizedSelections
          .map((selection) => {
            const heading = `## ${selection.match.targetTeam.name} vs. ${selection.match.opponent}`;
            const meta = `${formatDate(selection.match.startsAt)} | ${formatMatchVenue(selection.match.homeOrAway)}`;
            const table = selection.players.length
              ? [
                  "| Player | Source Team | Role |",
                  "| --- | --- | --- |",
                  ...selection.players.map((player) => {
                    const name = player.player.lastName
                      ? `${player.player.firstName} ${player.player.lastName}`
                      : player.player.firstName;

                    return `| ${name} | ${player.sourceTeamNameSnapshot} | ${formatSelectionRole(player.roleType)} |`;
                  }),
                ].join("\n")
              : "_No selected players_";

            return `${heading}\n\n${meta}\n\n${table}`;
          })
          .join("\n\n")
      : "No finalized selections available.";
  }

  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${buildFilename(format)}"`,
      "Content-Type": contentType,
    },
  });
}
