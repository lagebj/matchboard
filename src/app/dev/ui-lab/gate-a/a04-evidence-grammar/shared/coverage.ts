/**
 * Gate A W2 UI Lab candidate — A04 "evidence grammar" shared vocabulary
 * (`programme_v054/20_UI_LAB_CANDIDATE_WAVES.md` W2, `05_DATA_AND_VISUALIZATION_TRUTH.md`).
 *
 * Dev-only, under `/dev/ui-lab/gate-a/a04-evidence-grammar/**` only. No production code imports
 * this module. These six states are deliberately NOT a `value + hasData` boolean — a measure is
 * either a verified fact (`ZERO`/`COMPLETE`), genuinely unknowable (`UNKNOWN`), expected but
 * missing (`NOT_RECORDED`), out of scope (`NOT_APPLICABLE`), or partially observed (`PARTIAL`).
 * Absence must never silently render as `0`.
 */
export const COVERAGE_STATUSES = [
  "ZERO",
  "UNKNOWN",
  "NOT_RECORDED",
  "NOT_APPLICABLE",
  "PARTIAL",
  "COMPLETE",
] as const;

export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const COVERAGE_LABEL: Readonly<Record<CoverageStatus, string>> = {
  ZERO: "Zero (verified)",
  UNKNOWN: "Unknown",
  NOT_RECORDED: "Not recorded",
  NOT_APPLICABLE: "Not applicable",
  PARTIAL: "Partial",
  COMPLETE: "Complete",
};

/**
 * Renders a measure's displayed value from its coverage status — the single place that decides
 * whether a number is shown at all. Only `ZERO` (a verified-complete 0) and `COMPLETE` ever show
 * the raw numeric value; every absence/partial status renders its neutral textual label instead,
 * so a missing measurement can never be mistaken for a measured `0`.
 */
export function formatCoverageValue(status: CoverageStatus, value?: number): string {
  if ((status === "ZERO" || status === "COMPLETE") && value !== undefined) {
    return String(value);
  }
  return COVERAGE_LABEL[status];
}

export type SourceClass = "SYNTHETIC_LABELED";

/** One concrete, inspectable source record behind a displayed claim. */
export type SourceRecord = {
  sourceId: string;
  sourceClass: SourceClass;
  /** What kind of record this is, e.g. "League round opportunity record". */
  provenance: string;
  /** Match/date/group scope this record applies to. */
  scope: string;
  fieldLabel: string;
  fieldValue: string;
  coverage: CoverageStatus;
  /** Explicit deterministic transformation applied to reach a displayed value, if any. */
  transformation?: string;
};

/** Common fixture identity fields every A04 scenario fixture declares (`02_A04_SCOPE_AND_FIXTURE_TRUTH.md` "Fixture identity and typing"). */
export type FixtureIdentity = {
  scenarioId: string;
  fixtureId: string;
  fixtureVersion: number;
  fixtureSha256: string;
  sourceClass: SourceClass;
  fixedDateTimeUtc: string;
  viewerTimeZone: string;
  locale: "en-GB";
};
