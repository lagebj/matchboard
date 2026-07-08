const GAME_FORMAT_LABELS: Record<string, string> = {
  THREE_A_SIDE: "3-a-side",
  FIVE_A_SIDE: "5-a-side",
  SEVEN_A_SIDE: "7-a-side",
  NINE_A_SIDE: "9-a-side",
  ELEVEN_A_SIDE: "11-a-side",
};

export function formatGameFormat(gf: string): string {
  return GAME_FORMAT_LABELS[gf] ?? gf.replace(/_/g, "-").toLowerCase();
}