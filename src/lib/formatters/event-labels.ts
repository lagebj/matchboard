export const EVENT_TYPE_LABELS: Record<string, string> = {
  CUP: 'Cup',
  TOURNAMENT: 'Tournament',
  FRIENDLY_DAY: 'Friendly day',
  OTHER: 'Other',
};

export const EVENT_SQUAD_INTENT_LABELS: Record<string, string> = {
  COMPETITIVE: 'Competitive',
  BALANCED: 'Balanced',
  MANUAL: 'Manual',
};

export const EVENT_PLAYER_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
  UNKNOWN: 'Unknown',
  RESERVE: 'Reserve',
  LATE_ADDITION: 'Late addition',
  WITHDRAWN: 'Withdrawn',
};

export const EVENT_MATCH_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  CANCELLED: 'Cancelled',
};

export const EVENT_REPORT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  REPORTED: 'Reported',
  LOCKED: 'Completed',
};

export const GOALKEEPER_ABILITY_LABELS: Record<string, string> = {
  NO: 'No',
  EMERGENCY: 'Emergency',
  YES: 'Yes',
};

export const EVENT_MATCH_SUPPORT_ROLE_LABELS: Record<string, string> = {
  GK_COVER: 'GK cover',
  DEFENDER_COVER: 'Defender cover',
  MIDFIELD_COVER: 'Midfield cover',
  FORWARD_COVER: 'Forward cover',
  GENERAL_COVER: 'General cover',
};

export function formatEventType(type: string): string {
  return EVENT_TYPE_LABELS[type] ?? type;
}

export function formatEventSquadIntent(intent: string): string {
  return EVENT_SQUAD_INTENT_LABELS[intent] ?? intent;
}

export function formatEventPlayerStatus(status: string): string {
  return EVENT_PLAYER_STATUS_LABELS[status] ?? status;
}

export function formatEventMatchStatus(status: string): string {
  return EVENT_MATCH_STATUS_LABELS[status] ?? status;
}

export function formatEventMatchSupportRole(role: string | null | undefined): string {
  if (!role) return '';
  return EVENT_MATCH_SUPPORT_ROLE_LABELS[role] ?? role;
}

export function formatGoalkeeperAbility(ability: string | null): string {
  if (ability === null || ability === undefined) return 'Not rated';
  return GOALKEEPER_ABILITY_LABELS[ability] ?? ability;
}

export function formatPlayerName(firstName: string, lastName: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}