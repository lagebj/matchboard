type ExplanationInput = string | Record<string, unknown> | null | undefined;

interface ExplanationLine {
  label: string;
  value: string;
}

interface FormattedExplanation {
  summary: string;
  facts: ExplanationLine[];
  raw: string;
}

const KNOWN_FACT_KEYS = new Set([
  "summary",
  "autoSelected",
  "manuallyAdded",
  "manuallyRemoved",
  "sourceTeamName",
  "targetTeamName",
  "chosenPosition",
  "role",
  "reason",
  "explanationCode",
  "movementType",
  "isSupport",
  "isDevelopment",
  "isCore",
  "isSquadRepair",
]);

const FACT_LABELS: Record<string, string> = {
  autoSelected: "Automatic selection",
  manuallyAdded: "Manual addition",
  manuallyRemoved: "Manual removal",
  sourceTeamName: "Source team",
  targetTeamName: "Target team",
  chosenPosition: "Position",
  role: "Role",
  reason: "Reason",
  explanationCode: "Explanation code",
  movementType: "Movement type",
  isSupport: "Support role",
  isDevelopment: "Development role",
  isCore: "Core role",
  isSquadRepair: "Squad repair",
};

function formatBoolean(val: unknown): string {
  if (val === true) return "Yes";
  if (val === false) return "No";
  return String(val);
}

function safeParse(input: ExplanationInput): { parsed: Record<string, unknown> | null; raw: string } {
  if (input == null) return { parsed: null, raw: "" };
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return { parsed: null, raw: "" };
    if (trimmed.startsWith("{")) {
      try {
        return { parsed: JSON.parse(trimmed), raw: trimmed };
      } catch {
        return { parsed: null, raw: trimmed };
      }
    }
    return { parsed: null, raw: trimmed };
  }
  if (typeof input === "object") {
    return { parsed: input, raw: JSON.stringify(input) };
  }
  return { parsed: null, raw: String(input) };
}

export function formatExplanation(input: ExplanationInput): FormattedExplanation {
  const { parsed, raw } = safeParse(input);

  if (!parsed) {
    return {
      summary: raw || "No explanation available",
      facts: [],
      raw,
    };
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const facts: ExplanationLine[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === "summary") continue;
    if (value == null || value === "") continue;
    if (!KNOWN_FACT_KEYS.has(key)) continue;

    const label = FACT_LABELS[key] ?? key;
    const displayValue = typeof value === "boolean" ? formatBoolean(value) : String(value);
    facts.push({ label, value: displayValue });
  }

  return {
    summary: summary || raw,
    facts,
    raw,
  };
}

export function formatExplanationLines(input: ExplanationInput): string[] {
  const { summary, facts } = formatExplanation(input);
  const lines: string[] = [];

  if (summary) {
    lines.push(summary.endsWith(".") ? summary : summary + ".");
  }

  for (const fact of facts) {
    lines.push(`${fact.label}: ${fact.value}.`);
  }

  return lines;
}