import { describe, it, expect } from "vitest";
import {
  formatExplanation,
  formatWarningCode,
  formatSeverity,
  formatSelectionRole,
  formatCoachingIntent,
  formatMatchdayResponsibility,
  formatReadinessSignalType,
  formatFeedbackCategory,
  formatFeedbackValue,
  formatNextAction,
  formatAttendanceStatus,
} from "@/lib/match-utils";

describe("formatExplanation", () => {
  it("returns string input as-is", () => {
    expect(formatExplanation("Player was selected as core")).toBe("Player was selected as core");
  });

  it("extracts summary from object", () => {
    expect(formatExplanation({ summary: "Sent as support" })).toBe("Sent as support");
  });

  it("joins record summaries", () => {
    expect(formatExplanation({
      records: [
        { summary: "Sent as support" },
        { summary: "Squad repair" },
      ],
    })).toBe("Sent as support. Squad repair");
  });

  it("ignores records with no summary", () => {
    expect(formatExplanation({
      records: [
        { summary: "Valid" },
        { summary: "" },
        { other: "not a summary" },
      ],
    })).toBe("Valid");
  });

  it("returns empty string for null", () => {
    expect(formatExplanation(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatExplanation(undefined)).toBe("");
  });

  it("returns empty string for empty object with no summary", () => {
    expect(formatExplanation({})).toBe("");
  });

  it("returns empty string for object with empty summary", () => {
    expect(formatExplanation({ summary: "" })).toBe("");
  });

  it("returns empty string for empty records array", () => {
    expect(formatExplanation({ records: [] })).toBe("");
  });

  it("returns empty string for number", () => {
    expect(formatExplanation(42)).toBe("");
  });
});

describe("formatWarningCode", () => {
  it("formats known warning codes", () => {
    expect(formatWarningCode("core_player_overflow")).toBe("Core player overflow");
    expect(formatWarningCode("short_squad")).toBe("Short squad");
    expect(formatWarningCode("readiness_effort_trend")).toBe("Effort trend falling");
  });

  it("returns title-cased fallback for unknown codes", () => {
    expect(formatWarningCode("some_unknown_code")).toBe("Some Unknown Code");
  });
});

describe("formatSeverity", () => {
  it("formats severity levels", () => {
    expect(formatSeverity("HARD_BLOCK")).toBe("Blocking");
    expect(formatSeverity("REQUIRES_OVERRIDE")).toBe("Requires override");
    expect(formatSeverity("WARNING")).toBe("Warning");
    expect(formatSeverity("SCORING_PREFERENCE")).toBe("Preference");
  });

  it("returns unknown severity as-is", () => {
    expect(formatSeverity("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("formatSelectionRole", () => {
  it("formats all known roles", () => {
    expect(formatSelectionRole("CORE")).toBe("Core");
    expect(formatSelectionRole("SUPPORT")).toBe("Support");
    expect(formatSelectionRole("DEVELOPMENT")).toBe("Development");
    expect(formatSelectionRole("BACKFILL")).toBe("Squad Repair");
    expect(formatSelectionRole("CORE_MATCH_DROP")).toBe("Core Drop");
    expect(formatSelectionRole("REDUCED_MATCH_LOAD_DROP")).toBe("Reduced Load Drop");
  });
});

describe("formatCoachingIntent", () => {
  it("formats known intent categories", () => {
    expect(formatCoachingIntent("TEAM_FIRST")).toBe("Team first");
    expect(formatCoachingIntent("CONFIDENCE_REBUILD")).toBe("Confidence rebuild");
  });

  it("returns formatted fallback for unknown categories", () => {
    expect(formatCoachingIntent("SOME_NEW_INTENT")).toBe("some new intent");
  });
});

describe("formatMatchdayResponsibility", () => {
  it("formats known responsibilities", () => {
    expect(formatMatchdayResponsibility("STABILIZER")).toBe("Stabilizer");
    expect(formatMatchdayResponsibility("CHALLENGE_PLAYER")).toBe("Challenge player");
  });

  it("returns unknown value as-is", () => {
    expect(formatMatchdayResponsibility("NEW_RESP")).toBe("NEW_RESP");
  });
});

describe("formatReadinessSignalType", () => {
  it("formats known signal types", () => {
    expect(formatReadinessSignalType("EFFORT_TREND")).toBe("Effort trend");
    expect(formatReadinessSignalType("COACH_TRUST")).toBe("Coach trust");
  });

  it("returns formatted fallback for unknown types", () => {
    expect(formatReadinessSignalType("NEW_SIGNAL")).toBe("new signal");
  });
});

describe("formatFeedbackCategory", () => {
  it("formats known categories", () => {
    expect(formatFeedbackCategory("EFFORT")).toBe("Effort");
    expect(formatFeedbackCategory("TEAM_HELP")).toBe("Team help");
  });

  it("returns unknown value as-is", () => {
    expect(formatFeedbackCategory("OTHER")).toBe("OTHER");
  });
});

describe("formatFeedbackValue", () => {
  it("formats known values", () => {
    expect(formatFeedbackValue("POSITIVE")).toBe("Positive");
    expect(formatFeedbackValue("NEUTRAL")).toBe("Neutral");
    expect(formatFeedbackValue("NEEDS_ATTENTION")).toBe("Needs attention");
  });

  it("returns unknown value as-is", () => {
    expect(formatFeedbackValue("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("formatNextAction", () => {
  it("formats known actions", () => {
    expect(formatNextAction("NO_ACTION")).toBe("No action");
    expect(formatNextAction("MONITOR")).toBe("Monitor");
    expect(formatNextAction("ADJUST_PLANNING")).toBe("Adjust planning");
    expect(formatNextAction("COACH_CONVERSATION")).toBe("Coach conversation");
  });

  it("returns unknown value as-is", () => {
    expect(formatNextAction("OTHER")).toBe("OTHER");
  });
});

describe("formatAttendanceStatus", () => {
  it("formats known statuses", () => {
    expect(formatAttendanceStatus("PRESENT")).toBe("Present");
    expect(formatAttendanceStatus("NO_SHOW")).toBe("No-show");
    expect(formatAttendanceStatus("UNKNOWN")).toBe("Unknown");
  });

  it("returns unknown value as-is", () => {
    expect(formatAttendanceStatus("OTHER")).toBe("OTHER");
  });
});