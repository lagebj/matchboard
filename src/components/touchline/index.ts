/**
 * Touchline visual-system primitive barrel (ADR-0134). These are the components
 * that become the production primitives once the `/dev/ui-lab` human-approval
 * gate is passed (bundle `13_UI_LAB_AND_GOLDEN_GATE.md §9`).
 */
export { TouchlineMark } from "./brand/touchline-mark";
export { TouchlineWordmark } from "./brand/touchline-wordmark";
export { TouchlineBrandTile } from "./brand/touchline-brand-tile";

export { TouchlineButton } from "./controls/touchline-button";
export type { TouchlineButtonVariant, TouchlineButtonSize } from "./controls/touchline-button";
export { StatusText } from "./controls/status-text";
export type { StatusTone } from "./controls/status-text";

export { TouchlinePageHeader } from "./shell/touchline-page-header";
export { TouchlineSidebar } from "./shell/touchline-sidebar";
export { TouchlineRail } from "./shell/touchline-rail";
export { TouchlineBottomNav } from "./shell/touchline-bottom-nav";
export { TouchlineTopBar } from "./shell/touchline-top-bar";
export {
  buildTouchlineNav,
  TOUCHLINE_NAV_META,
  TOUCHLINE_NAV_ORDER,
} from "./shell/nav-model";
export type { TouchlineNavItem, TouchlineNavKey } from "./shell/nav-model";

export { TouchlineContextRail } from "./nav/touchline-context-rail";
export type { ContextRailItem } from "./nav/touchline-context-rail";

export { ScorebookMatchRow } from "./scorebook/scorebook-match-row";
export { ScorebookRoundSection } from "./scorebook/scorebook-round-section";

export { OperationalMatchCard } from "./match/operational-match-card";
export { MatchScoreHeader } from "./match/match-score-header";
export { LiveScoreStrip } from "./match/live-score-strip";

export { TouchlineTimeline, TimelineItem } from "./timeline/touchline-timeline";
export type { TimelineNodeState } from "./timeline/touchline-timeline";

export { EvidenceStory } from "./evidence/evidence-story";
export { PhaseDistribution } from "./evidence/phase-distribution";
export type { PhaseSegment } from "./evidence/phase-distribution";
export { OutcomePair } from "./evidence/outcome-pair";

export { WorkbenchToolbar } from "./workbench/workbench-toolbar";
export { RosterColumn } from "./workbench/roster-column";
export { RosterRow } from "./workbench/roster-row";
export { TouchlineInspector, InspectorFact } from "./workbench/touchline-inspector";
export { WorkbenchSummaryStrip } from "./workbench/workbench-summary-strip";
export type { WorkbenchSummaryItem } from "./workbench/workbench-summary-strip";
export { BenchRail } from "./workbench/bench-rail";
export type { BenchRailPlayer } from "./workbench/bench-rail";
export { PositionFitList } from "./workbench/position-fit-list";
export type { PositionFitEntry } from "./workbench/position-fit-list";
export { PlayerContextHeader } from "./workbench/player-context-header";

export { TouchlineBottomSheet } from "./overlay/touchline-bottom-sheet";
export { AppearanceControl } from "./theme/appearance-control";

export { TouchlineWidget } from "./widget/touchline-widget";
export type { TouchlineWidgetTone, TouchlineWidgetPadding } from "./widget/touchline-widget";
export { WidgetHeader } from "./widget/widget-header";
export { MetricStrip } from "./widget/metric-strip";
export type { MetricStripItem } from "./widget/metric-strip";
export { CapacityBar } from "./widget/capacity-bar";
export { QuickActionGrid } from "./widget/quick-action-grid";
export type { QuickAction } from "./widget/quick-action-grid";

export { PitchPlayerToken, PitchEmptySlot } from "./pitch/pitch-player-token";
export type { PitchPlayerTokenStatus } from "./pitch/pitch-player-token";

export { LiveActionGrid } from "./live/live-action-grid";
export type { LiveAction, LiveActionTone } from "./live/live-action-grid";
