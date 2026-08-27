export type PlayingStyleTag =
  | "HIGH_PRESSING"
  | "LOW_BLOCK"
  | "POSSESSION_BASED"
  | "DIRECT_PLAY"
  | "COUNTER_ATTACKING"
  | "PHYSICAL_AND_DIRECT"
  | "TECHNICAL_AND_PATIENT"
  | "FAST_PACED_TRANSITIONS"
  | "SLOW_BUILD_UP"
  | "DISCIPLINED_DEFENSIVE_SHAPE"
  | "MAN_TO_MAN_MARKING"
  | "ZONAL_PRESSING"
  | "MIXED_TRANSITIONS"
  | "SET_PIECE_ORIENTED"
  | "INDIVIDUAL_DRIBBLING"
  | "COMPACT_MIDFIELD"
  | "WIDE_PLAY_ORIENTED";

export const PLAYING_STYLE_TAG_LABELS: Record<PlayingStyleTag, string> = {
  HIGH_PRESSING: "High pressing",
  LOW_BLOCK: "Low block",
  POSSESSION_BASED: "Possession-based",
  DIRECT_PLAY: "Direct play",
  COUNTER_ATTACKING: "Counter-attacking",
  PHYSICAL_AND_DIRECT: "Physical and direct",
  TECHNICAL_AND_PATIENT: "Technical and patient",
  FAST_PACED_TRANSITIONS: "Fast-paced transitions",
  SLOW_BUILD_UP: "Slow build-up",
  DISCIPLINED_DEFENSIVE_SHAPE: "Disciplined defensive shape",
  MAN_TO_MAN_MARKING: "Man-to-man marking",
  ZONAL_PRESSING: "Zonal pressing",
  MIXED_TRANSITIONS: "Mixed transitions",
  SET_PIECE_ORIENTED: "Set piece-oriented",
  INDIVIDUAL_DRIBBLING: "Individual dribbling",
  COMPACT_MIDFIELD: "Compact midfield",
  WIDE_PLAY_ORIENTED: "Wide play-oriented",
};

export const PLAYING_STYLE_TAG_GROUPS: Array<{ label: string; tags: PlayingStyleTag[] }> = [
  {
    label: "Attacking style",
    tags: [
      "POSSESSION_BASED",
      "DIRECT_PLAY",
      "COUNTER_ATTACKING",
      "PHYSICAL_AND_DIRECT",
      "TECHNICAL_AND_PATIENT",
      "FAST_PACED_TRANSITIONS",
      "SLOW_BUILD_UP",
    ],
  },
  {
    label: "Defensive shape",
    tags: [
      "HIGH_PRESSING",
      "LOW_BLOCK",
      "DISCIPLINED_DEFENSIVE_SHAPE",
      "MAN_TO_MAN_MARKING",
      "ZONAL_PRESSING",
      "COMPACT_MIDFIELD",
    ],
  },
  {
    label: "Transitions and set pieces",
    tags: [
      "MIXED_TRANSITIONS",
      "SET_PIECE_ORIENTED",
      "INDIVIDUAL_DRIBBLING",
      "WIDE_PLAY_ORIENTED",
    ],
  },
];

const MAX_PLAYING_STYLE_TAGS = 5;

const ALL_VALID_TAGS = new Set<PlayingStyleTag>([
  "HIGH_PRESSING",
  "LOW_BLOCK",
  "POSSESSION_BASED",
  "DIRECT_PLAY",
  "COUNTER_ATTACKING",
  "PHYSICAL_AND_DIRECT",
  "TECHNICAL_AND_PATIENT",
  "FAST_PACED_TRANSITIONS",
  "SLOW_BUILD_UP",
  "DISCIPLINED_DEFENSIVE_SHAPE",
  "MAN_TO_MAN_MARKING",
  "ZONAL_PRESSING",
  "MIXED_TRANSITIONS",
  "SET_PIECE_ORIENTED",
  "INDIVIDUAL_DRIBBLING",
  "COMPACT_MIDFIELD",
  "WIDE_PLAY_ORIENTED",
]);

export function validatePlayingStyleTags(tags: unknown[]): { valid: true; tags: PlayingStyleTag[] } | { valid: false; error: string } {
  if (tags.length > MAX_PLAYING_STYLE_TAGS) {
    return { valid: false, error: `Select at most ${MAX_PLAYING_STYLE_TAGS} playing style tags per encounter.` };
  }

  for (const tag of tags) {
    if (!ALL_VALID_TAGS.has(tag as PlayingStyleTag)) {
      return { valid: false, error: `Invalid playing style tag: ${tag}` };
    }
  }

  const deduplicated = [...new Set(tags)] as PlayingStyleTag[];
  return { valid: true, tags: deduplicated };
}