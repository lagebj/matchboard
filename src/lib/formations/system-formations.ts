import type { GameFormat } from "@/generated/prisma/client";
import type { FormationSlotData } from "./types";

type SystemFormationDefinition = {
  name: string;
  gameFormat: GameFormat;
  description: string;
  slots: FormationSlotData[];
};

export const SYSTEM_FORMATIONS: SystemFormationDefinition[] = [
  // 3v3
  {
    name: "1-1-1",
    gameFormat: "THREE_A_SIDE",
    description: "3v3 formation with one forward, one midfielder, one defender",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"], sortOrder: 0 },
      { gridX: 2, gridY: 2, label: "Central Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "flexible"], sortOrder: 1 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder", "flexible"], sortOrder: 2 },
    ],
  },
  {
    name: "2-1",
    gameFormat: "THREE_A_SIDE",
    description: "3v3 formation with two defenders and one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"], sortOrder: 0 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder", "flexible"], sortOrder: 1 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder", "flexible"], sortOrder: 2 },
    ],
  },
  {
    name: "1-2",
    gameFormat: "THREE_A_SIDE",
    description: "3v3 formation with one defender and two forwards",
    slots: [
      { gridX: 1, gridY: 0, label: "Left Central Forward", shortLabel: "LCF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"], sortOrder: 0 },
      { gridX: 3, gridY: 0, label: "Right Central Forward", shortLabel: "RCF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"], sortOrder: 1 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder", "flexible"], sortOrder: 2 },
    ],
  },

  // 5v5
  {
    name: "GK + 1-2-1",
    gameFormat: "FIVE_A_SIDE",
    description: "5v5 formation with goalkeeper, one defender, two midfielders, one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 1, gridY: 2, label: "Left Central Midfield", shortLabel: "LCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 1 },
      { gridX: 3, gridY: 2, label: "Right Central Midfield", shortLabel: "RCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 3 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 4 },
    ],
  },
  {
    name: "GK + 2-1-1",
    gameFormat: "FIVE_A_SIDE",
    description: "5v5 formation with goalkeeper, two defenders, one midfielder, one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 2, gridY: 2, label: "Central Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 1 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 2 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 3 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 4 },
    ],
  },
  {
    name: "GK + 1-1-2",
    gameFormat: "FIVE_A_SIDE",
    description: "5v5 formation with goalkeeper, one defender, one midfielder, two forwards",
    slots: [
      { gridX: 1, gridY: 0, label: "Left Central Forward", shortLabel: "LCF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"], sortOrder: 0 },
      { gridX: 3, gridY: 0, label: "Right Central Forward", shortLabel: "RCF", roleType: "FORWARD", acceptedPositionIds: ["forward", "midfielder"], sortOrder: 1 },
      { gridX: 2, gridY: 2, label: "Central Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 2 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 3 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 4 },
    ],
  },

  // 7v7
  {
    name: "GK + 2-3-1",
    gameFormat: "SEVEN_A_SIDE",
    description: "7v7 formation with goalkeeper, two defenders, three midfielders, one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 1, gridY: 2, label: "Left Central Midfield", shortLabel: "LCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 1 },
      { gridX: 2, gridY: 2, label: "Central Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 2 },
      { gridX: 3, gridY: 2, label: "Right Central Midfield", shortLabel: "RCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 3 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 4 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 5 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 6 },
    ],
  },
  {
    name: "GK + 2-1-2-1",
    gameFormat: "SEVEN_A_SIDE",
    description: "7v7 formation with goalkeeper, two defenders, one defensive mid, two attacking mids, one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 1, gridY: 1, label: "Left Attacking Midfield", shortLabel: "LAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 1 },
      { gridX: 3, gridY: 1, label: "Right Attacking Midfield", shortLabel: "RAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 2, gridY: 3, label: "Centre Defensive Midfield", shortLabel: "CDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender"], sortOrder: 3 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 4 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 5 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 6 },
    ],
  },
  {
    name: "GK + 3-2-1",
    gameFormat: "SEVEN_A_SIDE",
    description: "7v7 formation with goalkeeper, three defenders, two midfielders, one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 1, gridY: 2, label: "Left Central Midfield", shortLabel: "LCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 1 },
      { gridX: 3, gridY: 2, label: "Right Central Midfield", shortLabel: "RCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 3 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 4 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 5 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 6 },
    ],
  },

  // 9v9
  {
    name: "GK + 3-3-2",
    gameFormat: "NINE_A_SIDE",
    description: "9v9 formation with goalkeeper, three defenders, three midfielders, two forwards",
    slots: [
      { gridX: 1, gridY: 0, label: "Left Central Forward", shortLabel: "LCF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 3, gridY: 0, label: "Right Central Forward", shortLabel: "RCF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 1 },
      { gridX: 1, gridY: 2, label: "Left Central Midfield", shortLabel: "LCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 2, gridY: 2, label: "Central Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 3 },
      { gridX: 3, gridY: 2, label: "Right Central Midfield", shortLabel: "RCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 4 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 5 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 6 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 7 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 8 },
    ],
  },
  {
    name: "GK + 3-1-3-1",
    gameFormat: "NINE_A_SIDE",
    description: "9v9 formation with goalkeeper, three defenders, one defensive mid, three attacking mids, one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 1, gridY: 1, label: "Left Attacking Midfield", shortLabel: "LAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 1 },
      { gridX: 2, gridY: 1, label: "Central Attacking Midfield", shortLabel: "CAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 3, gridY: 1, label: "Right Attacking Midfield", shortLabel: "RAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 3 },
      { gridX: 2, gridY: 3, label: "Centre Defensive Midfield", shortLabel: "CDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender"], sortOrder: 4 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 5 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 6 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 7 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 8 },
    ],
  },
  {
    name: "GK + 2-3-2",
    gameFormat: "NINE_A_SIDE",
    description: "9v9 formation with goalkeeper, two defenders, one defensive midfielder, two midfielders, two forwards",
    slots: [
      { gridX: 1, gridY: 0, label: "Left Central Forward", shortLabel: "LCF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 3, gridY: 0, label: "Right Central Forward", shortLabel: "RCF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 1 },
      { gridX: 1, gridY: 2, label: "Left Central Midfield", shortLabel: "LCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 3, gridY: 2, label: "Right Central Midfield", shortLabel: "RCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 3 },
      { gridX: 2, gridY: 3, label: "Centre Defensive Midfield", shortLabel: "CDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender"], sortOrder: 4 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 5 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 6 },
      { gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 7 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 8 },
    ],
  },

  // 11v11
  {
    name: "GK + 4-3-3",
    gameFormat: "ELEVEN_A_SIDE",
    description: "11v11 formation with goalkeeper, four defenders, three midfielders, three forwards",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 1, gridY: 1, label: "Left Attacking Midfield", shortLabel: "LAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 1 },
      { gridX: 3, gridY: 1, label: "Right Attacking Midfield", shortLabel: "RAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 1, gridY: 2, label: "Left Central Midfield", shortLabel: "LCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 3 },
      { gridX: 2, gridY: 2, label: "Central Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 4 },
      { gridX: 3, gridY: 2, label: "Right Central Midfield", shortLabel: "RCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 5 },
      { gridX: 0, gridY: 4, label: "Left Back", shortLabel: "LB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 6 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 7 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 8 },
      { gridX: 4, gridY: 4, label: "Right Back", shortLabel: "RB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 9 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 10 },
    ],
  },
  {
    name: "GK + 4-4-2",
    gameFormat: "ELEVEN_A_SIDE",
    description: "11v11 formation with goalkeeper, four defenders, four midfielders, two forwards",
    slots: [
      { gridX: 1, gridY: 0, label: "Left Central Forward", shortLabel: "LCF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 3, gridY: 0, label: "Right Central Forward", shortLabel: "RCF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 1 },
      { gridX: 0, gridY: 2, label: "Left Midfield", shortLabel: "LM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 1, gridY: 2, label: "Left Central Midfield", shortLabel: "LCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 3 },
      { gridX: 3, gridY: 2, label: "Right Central Midfield", shortLabel: "RCM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 4 },
      { gridX: 4, gridY: 2, label: "Right Midfield", shortLabel: "RM", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 5 },
      { gridX: 0, gridY: 4, label: "Left Back", shortLabel: "LB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 6 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 7 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 8 },
      { gridX: 4, gridY: 4, label: "Right Back", shortLabel: "RB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 9 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 10 },
    ],
  },
  {
    name: "GK + 4-2-3-1",
    gameFormat: "ELEVEN_A_SIDE",
    description: "11v11 formation with goalkeeper, four defenders, two defensive mids, three attacking mids, one forward",
    slots: [
      { gridX: 2, gridY: 0, label: "Central Forward", shortLabel: "CF", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 0 },
      { gridX: 1, gridY: 1, label: "Left Attacking Midfield", shortLabel: "LAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 1 },
      { gridX: 2, gridY: 1, label: "Central Attacking Midfield", shortLabel: "CAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 2 },
      { gridX: 3, gridY: 1, label: "Right Attacking Midfield", shortLabel: "RAM", roleType: "ATTACKING_MIDFIELDER", acceptedPositionIds: ["midfielder", "forward"], sortOrder: 3 },
      { gridX: 1, gridY: 3, label: "Left Defensive Midfield", shortLabel: "LDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender"], sortOrder: 4 },
      { gridX: 3, gridY: 3, label: "Right Defensive Midfield", shortLabel: "RDM", roleType: "DEFENSIVE_MIDFIELDER", acceptedPositionIds: ["midfielder", "defender"], sortOrder: 5 },
      { gridX: 0, gridY: 4, label: "Left Back", shortLabel: "LB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 6 },
      { gridX: 1, gridY: 4, label: "Left Centre Back", shortLabel: "LCB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 7 },
      { gridX: 3, gridY: 4, label: "Right Centre Back", shortLabel: "RCB", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 8 },
      { gridX: 4, gridY: 4, label: "Right Back", shortLabel: "RB", roleType: "DEFENDER", acceptedPositionIds: ["defender", "midfielder"], sortOrder: 9 },
      { gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER", acceptedPositionIds: ["goalkeeper"], sortOrder: 10 },
    ],
  },
];

export function getSystemFormationsForFormat(gameFormat: GameFormat): SystemFormationDefinition[] {
  return SYSTEM_FORMATIONS.filter((f) => f.gameFormat === gameFormat);
}
