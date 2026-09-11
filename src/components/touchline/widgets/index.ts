/**
 * Touchline Design Atlas semantic widgets (`04_WIDGET_COMPONENT_CONTRACTS.md §2`,
 * `12_CODE_CHANGE_MAP.md §2`). Each widget represents meaning, not a generic `DashboardCard` with
 * a variant string. They build on `TouchlineWidgetFrame` (`src/components/touchline/widget/`) and
 * the viz primitives (`src/components/touchline/viz/`).
 */
export { NextMatchHero } from "./next-match-hero";
export type { NextMatchHeroProps } from "./next-match-hero";

export { AttentionWidget } from "./attention-widget";
export type { AttentionWidgetProps, AttentionItem } from "./attention-widget";

export { SquadReadinessWidget } from "./squad-readiness-widget";
export type { SquadReadinessWidgetProps, SquadReadinessException } from "./squad-readiness-widget";

export { RecentFootballWidget } from "./recent-football-widget";
export type { RecentFootballWidgetProps } from "./recent-football-widget";

export { ScheduleWidget } from "./schedule-widget";
export type { ScheduleWidgetProps, ScheduleWidgetItem } from "./schedule-widget";

export { EvidenceSpotlightWidget } from "./evidence-spotlight-widget";
export type { EvidenceSpotlightWidgetProps } from "./evidence-spotlight-widget";

export { ParticipationLoadWidget } from "./participation-load-widget";
export type { ParticipationLoadWidgetProps } from "./participation-load-widget";

export { RoleUsageWidget } from "./role-usage-widget";
export type { RoleUsageWidgetProps } from "./role-usage-widget";

export { MovementHistoryWidget } from "./movement-history-widget";
export type { MovementHistoryWidgetProps, MovementHistoryRow } from "./movement-history-widget";

export { OpportunityWidget } from "./opportunity-widget";
export type { OpportunityWidgetProps } from "./opportunity-widget";

export { PositionExposureWidget } from "./position-exposure-widget";
export type { PositionExposureWidgetProps } from "./position-exposure-widget";

export { EventDayWidget } from "./event-day-widget";
export type { EventDayWidgetProps, EventDayItem } from "./event-day-widget";

export { PlanningReadinessWidget } from "./planning-readiness-widget";
export type { PlanningReadinessWidgetProps, PlanningReadinessCheck, PlanningReadinessWarning } from "./planning-readiness-widget";
