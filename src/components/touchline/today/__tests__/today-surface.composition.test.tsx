import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Same pre-existing test-infra gap documented in today-surface.matchday-livenow-gate.test.tsx —
// DueDecisionReviewSection transitively imports a "use server" actions module that does not
// resolve under vitest's jsdom component config. `reviews` is empty in every fixture below.
vi.mock("@/components/assistant/due-decision-review-section", () => ({
  DueDecisionReviewSection: () => null,
}));

const { TodaySurface } = await import("@/components/touchline/today/today-surface");
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import type { AssistantCommandCentre } from "@/lib/assistant/types";
import type { CoachSituationProjection, CoachDecision } from "@/lib/situational/situation-types";

function baseCommandCentre(overrides: Partial<AssistantCommandCentre> = {}): AssistantCommandCentre {
  return {
    leagueSeasonId: null,
    leagueSeasonName: null,
    items: [],
    todayMatches: [],
    dueDecisionReviews: [],
    roundPlanIntegrities: {},
    activeLiveSessions: {},
    computedAt: new Date("2026-09-15T12:00:00.000Z"),
    ...overrides,
  };
}

function coachDecision(overrides: Partial<CoachDecision> = {}): CoachDecision {
  return {
    id: "d1",
    candidateId: "c1",
    situation: "NEXT",
    horizon: "NEXT",
    visibility: "NORMAL",
    urgency: "NORMAL",
    interaction: "INFORM",
    title: "A decision needs attention",
    summary: "Something changed that needs a look.",
    alternatives: [],
    affectedEntities: [],
    reasonCodes: ["REQUIRES_REVIEW"],
    ...overrides,
  };
}

function projection(decisions: CoachDecision[]): CoachSituationProjection {
  return {
    situation: { nowIso: "2026-09-15T12:00:00.000Z", primarySituation: "NEXT", imminentMatchIds: [], temporal: {} },
    decisions,
    deferredCount: 0,
    status: decisions.length > 0 ? "ACTION_REQUIRED" : "READY",
    policyRuntimeStatus: "HEALTHY",
  };
}

function renderSurface(props: { decisions?: CoachDecision[] } = {}) {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <TodaySurface
        commandCentre={baseCommandCentre()}
        projection={projection(props.decisions ?? [])}
        selectionDecisions={[]}
        applyRecommendation={vi.fn()}
        carryForwardItems={[]}
      />
    </OrgSlugProvider>,
  );
}

describe("TodaySurface composition (ADR-0157 §6)", () => {
  it("renders the quiet-day calm hero and no Next Action/Selection/Planning/Other sections when there is nothing to act on", () => {
    renderSurface({ decisions: [] });
    expect(screen.getByText("Nothing needs your attention.")).toBeInTheDocument();
    expect(screen.queryByText("RECOMMENDED BECAUSE")).not.toBeInTheDocument();
    expect(screen.queryByText("Selection decisions")).not.toBeInTheDocument();
  });

  it("never renders InstallPwaCard, in either composition", () => {
    renderSurface({ decisions: [] });
    expect(screen.queryByText(/install/i)).not.toBeInTheDocument();
    renderSurface({ decisions: [coachDecision()] });
    expect(screen.queryByText(/install matchboard/i)).not.toBeInTheDocument();
  });

  it("renders the decision-day primary action and its Why? disclosure instead of the calm hero", () => {
    renderSurface({ decisions: [coachDecision()] });
    expect(screen.queryByText("Nothing needs your attention.")).not.toBeInTheDocument();
    expect(screen.getByText("A decision needs attention")).toBeInTheDocument();
    expect(screen.getByText("Why?")).toBeInTheDocument();
    expect(screen.getByText("This needs review in its own workspace rather than a single action.")).toBeInTheDocument();
  });
});
