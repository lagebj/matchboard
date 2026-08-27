import { SectionHeader } from "@/components/ui/section-header";
import { Surface } from "@/components/ui/surface";
import type { CombinationEvidenceRow } from "@/lib/evidence/combination-topology";

type PlayerOption = { id: string; name: string };

type MatchCombinationEvidencePanelProps = {
  evidence: CombinationEvidenceRow[];
  players: PlayerOption[];
};

const FAMILY_LABELS: Record<string, string> = {
  PARTNERSHIP: "Partnership",
  TRIANGLE: "Triangle",
  LINE: "Line",
  CORRIDOR: "Corridor",
  FUNCTIONAL_UNIT: "Functional unit",
  FULL_CONFIGURATION: "Full configuration",
};

const SUBTYPE_LABELS: Record<string, string> = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical",
  GOALKEEPER_LINK: "goalkeeper link",
  DEFENSIVE: "defensive",
  CENTRAL_SPINE: "central spine",
  WIDE: "wide",
  MIDFIELD: "midfield",
  ATTACKING: "attacking",
  LEFT: "left",
  CENTRE: "centre",
  RIGHT: "right",
  BUILD_UP: "build-up",
  DEFENSIVE_CORE: "defensive core",
  CENTRAL_UNIT: "central unit",
  ATTACKING_UNIT: "attacking unit",
};

// Minutes below this are too small to be worth showing per match — noise, not evidence.
const MIN_MINUTES_TO_SHOW = 10;
const MAX_ROWS_SHOWN = 8;

function describe(row: CombinationEvidenceRow, nameById: Map<string, string>): string {
  const names = row.playerIds.map((id) => nameById.get(id) ?? "Unknown player").join(" + ");
  const familyLabel = FAMILY_LABELS[row.family] ?? row.family;
  const subtypeLabel = row.subtype ? SUBTYPE_LABELS[row.subtype] ?? row.subtype.toLowerCase() : null;
  const label = subtypeLabel ? `${subtypeLabel} ${familyLabel.toLowerCase()}` : familyLabel;
  return `${names} — ${label}`;
}

function outcomeLine(row: CombinationEvidenceRow): string {
  const parts: string[] = [`${Math.round(row.minutesTogether)} min this match`];
  if (row.goalsForWhilePresent > 0 || row.goalsAgainstWhilePresent > 0) {
    if (row.goalsForWhilePresent > 0) parts.push(`team scored ${row.goalsForWhilePresent} while present`);
    if (row.goalsAgainstWhilePresent > 0) parts.push(`team conceded ${row.goalsAgainstWhilePresent} while present`);
  }
  if (row.directGoalContributions > 0) {
    parts.push(`${row.directGoalContributions} direct goal contribution${row.directGoalContributions === 1 ? "" : "s"}`);
  }
  if (row.directAssistContributions > 0) {
    parts.push(`${row.directAssistContributions} direct assist contribution${row.directAssistContributions === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

/**
 * Factual, per-match combination evidence — what actually happened while a football
 * relationship existed on the pitch this match. No chemistry score, no leaderboard (see
 * DECISIONS.md "Combination evidence"). Season-aggregated evidence lives in the Player
 * Combinations insight (I-005); this panel is deliberately match-scoped.
 */
export function MatchCombinationEvidencePanel({ evidence, players }: MatchCombinationEvidencePanelProps) {
  const nameById = new Map(players.map((p) => [p.id, p.name]));

  const rows = evidence
    .filter((row) => row.family === "PARTNERSHIP" || row.family === "TRIANGLE")
    .filter((row) => row.minutesTogether >= MIN_MINUTES_TO_SHOW)
    .sort((a, b) => b.minutesTogether - a.minutesTogether)
    .slice(0, MAX_ROWS_SHOWN);

  if (rows.length === 0) return null;

  return (
    <Surface variant="default" padding="sm">
      <SectionHeader
        title="Combination evidence"
        description="What actually happened while these relationships existed on the pitch this match."
      />
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-sm">
            <p className="font-medium text-zinc-100">{describe(row, nameById)}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{outcomeLine(row)}</p>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
