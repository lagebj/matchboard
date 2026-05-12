export interface FixturesOverview {
  periods: FixturePeriod[];
}

export interface FixturePeriod {
  id: string;
  title: string;
  dateRange?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  unresolvedIssueCount: number;
  rounds: FixtureRound[];
}

export interface FixtureRound {
  id: string;
  title: string;
  dateRange?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  generated: boolean;
  published: boolean;
  unresolvedIssueCount: number;
  matches: FixtureMatch[];
}

export interface FixtureMatch {
  id: string;
  title: string;
  teamId: string;
  teamName: string;
  opponent?: string;
  startsAt?: string;
  venue?: string;
  readinessState?: "READY" | "WATCH" | "AT_RISK" | "NOT_PLAYABLE";
  selectedPlayerCount?: number;
  unresolvedIssueCount: number;
  postMatchStatus?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
}