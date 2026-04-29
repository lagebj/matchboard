export type FormationSlot = {
  slot: string;
  row: number;
  col: number;
};

export type Formation = {
  id: string;
  label: string;
  gameFormat: string;
  slots: FormationSlot[];
  cols: number;
};

const FORMATIONS: Formation[] = [
  {
    id: "7v7-1-2-3-1",
    label: "7v7 · 1-2-3-1",
    gameFormat: "SEVEN_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB1", row: 1, col: 0 },
      { slot: "CB2", row: 1, col: 2 },
      { slot: "CM", row: 2, col: 1 },
      { slot: "RM", row: 2, col: 2 },
      { slot: "LM", row: 2, col: 0 },
      { slot: "ST", row: 3, col: 1 },
    ],
  },
  {
    id: "7v7-1-3-2-1",
    label: "7v7 · 1-3-2-1",
    gameFormat: "SEVEN_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB", row: 1, col: 1 },
      { slot: "RM", row: 1, col: 2 },
      { slot: "LM", row: 1, col: 0 },
      { slot: "CM1", row: 2, col: 0 },
      { slot: "CM2", row: 2, col: 2 },
      { slot: "ST", row: 3, col: 1 },
    ],
  },
  {
    id: "9v9-1-3-3-2",
    label: "9v9 · 1-3-3-2",
    gameFormat: "NINE_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB1", row: 1, col: 0 },
      { slot: "CB2", row: 1, col: 1 },
      { slot: "CB3", row: 1, col: 2 },
      { slot: "RM", row: 2, col: 2 },
      { slot: "CM1", row: 2, col: 1 },
      { slot: "LM", row: 2, col: 0 },
      { slot: "ST1", row: 3, col: 0 },
      { slot: "ST2", row: 3, col: 2 },
    ],
  },
  {
    id: "9v9-1-3-2-3",
    label: "9v9 · 1-3-2-3",
    gameFormat: "NINE_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "CB1", row: 1, col: 0 },
      { slot: "CB2", row: 1, col: 1 },
      { slot: "CB3", row: 1, col: 2 },
      { slot: "CM1", row: 2, col: 0 },
      { slot: "CM2", row: 2, col: 2 },
      { slot: "RW", row: 3, col: 2 },
      { slot: "ST", row: 3, col: 1 },
      { slot: "LW", row: 3, col: 0 },
    ],
  },
  {
    id: "11v11-4-3-3",
    label: "11v11 · 4-3-3",
    gameFormat: "ELEVEN_A_SIDE",
    cols: 3,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "RB", row: 1, col: 2 },
      { slot: "CB1", row: 1, col: 1 },
      { slot: "CB2", row: 1, col: 0 },
      { slot: "LB", row: 1, col: 0 },
      { slot: "CM1", row: 2, col: 0 },
      { slot: "CM2", row: 2, col: 1 },
      { slot: "CM3", row: 2, col: 2 },
      { slot: "RW", row: 3, col: 2 },
      { slot: "ST", row: 3, col: 1 },
      { slot: "LW", row: 3, col: 0 },
    ],
  },
  {
    id: "11v11-4-4-2",
    label: "11v11 · 4-4-2",
    gameFormat: "ELEVEN_A_SIDE",
    cols: 4,
    slots: [
      { slot: "GK", row: 0, col: 1 },
      { slot: "RB", row: 1, col: 3 },
      { slot: "CB1", row: 1, col: 2 },
      { slot: "CB2", row: 1, col: 1 },
      { slot: "LB", row: 1, col: 0 },
      { slot: "RM", row: 2, col: 3 },
      { slot: "CM1", row: 2, col: 2 },
      { slot: "CM2", row: 2, col: 1 },
      { slot: "LM", row: 2, col: 0 },
      { slot: "ST1", row: 3, col: 2 },
      { slot: "ST2", row: 3, col: 1 },
    ],
  },
];

export function getFormationsForFormat(gameFormat: string): Formation[] {
  return FORMATIONS.filter((f) => f.gameFormat === gameFormat);
}

export function getDefaultFormation(gameFormat: string): Formation {
  const formations = getFormationsForFormat(gameFormat);
  return formations[0] ?? FORMATIONS[0];
}

export function getFormationById(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}

export function formatGameFormat(gameFormat: string): string {
  switch (gameFormat) {
    case "SEVEN_A_SIDE":
      return "7-a-side";
    case "NINE_A_SIDE":
      return "9-a-side";
    case "ELEVEN_A_SIDE":
      return "11-a-side";
    default:
      return gameFormat;
  }
}