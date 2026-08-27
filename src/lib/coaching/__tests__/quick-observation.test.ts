import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockObservationCreate,
  mockObservationFindFirst,
  mockObservationFindMany,
  mockObservationUpdate,
  mockMatchFindFirst,
  mockEncounterFindUnique,
  mockEncounterCreate,
  mockEncounterUpdate,
  mockAddObservation,
  mockUpsertTeamReflection,
  mockGetTeamReflection,
} = vi.hoisted(() => ({
  mockObservationCreate: vi.fn(),
  mockObservationFindFirst: vi.fn(),
  mockObservationFindMany: vi.fn(),
  mockObservationUpdate: vi.fn(),
  mockMatchFindFirst: vi.fn(),
  mockEncounterFindUnique: vi.fn(),
  mockEncounterCreate: vi.fn(),
  mockEncounterUpdate: vi.fn(),
  mockAddObservation: vi.fn(),
  mockUpsertTeamReflection: vi.fn(),
  mockGetTeamReflection: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    quickObservation: {
      create: mockObservationCreate,
      findFirst: mockObservationFindFirst,
      findMany: mockObservationFindMany,
      update: mockObservationUpdate,
    },
    match: { findFirst: mockMatchFindFirst },
    opponentEncounterObservation: {
      findUnique: mockEncounterFindUnique,
      create: mockEncounterCreate,
      update: mockEncounterUpdate,
    },
  },
}));

vi.mock("@/lib/planned-rotation/development-thread", () => ({
  addObservation: mockAddObservation,
}));

vi.mock("@/lib/coaching/team-reflection", () => ({
  upsertTeamReflection: mockUpsertTeamReflection,
  getTeamReflection: mockGetTeamReflection,
}));

import {
  createQuickObservation,
  getQuickObservations,
  discardQuickObservation,
  keepQuickObservationAsNote,
  convertQuickObservationToDevelopmentThread,
  convertQuickObservationToTeamReflection,
  convertQuickObservationToOpponentObservation,
} from "../quick-observation";

const orgFilter = { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" };

const OPEN_OBSERVATION = {
  id: "obs-1",
  organisationId: "org-1",
  matchId: "match-1",
  playerIds: ["p1", "p2"],
  note: "Recovered position quickly after losing the ball",
  status: "OPEN",
  convertedToType: null,
  convertedToId: null,
  convertedAt: null,
  recordedBy: "coach@example.com",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("createQuickObservation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an observation with minimal fields", async () => {
    mockObservationCreate.mockResolvedValue(OPEN_OBSERVATION);

    const result = await createQuickObservation({ note: "  Good recovery run  " }, orgFilter);

    expect(result.note).toBe("Recovered position quickly after losing the ball");
    expect(mockObservationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ note: "Good recovery run" }) }),
    );
  });

  it("rejects an empty note", async () => {
    await expect(createQuickObservation({ note: "   " }, orgFilter)).rejects.toThrow(/cannot be empty/);
  });

  it("rejects a note over the max length", async () => {
    await expect(createQuickObservation({ note: "x".repeat(1001) }, orgFilter)).rejects.toThrow(/characters or fewer/);
  });

  it("validates the match exists when a matchId is provided", async () => {
    mockMatchFindFirst.mockResolvedValue(null);
    await expect(createQuickObservation({ note: "note", matchId: "missing-match" }, orgFilter)).rejects.toThrow(/Match not found/);
  });

  it("deduplicates player ids", async () => {
    mockMatchFindFirst.mockResolvedValue({ id: "match-1" });
    mockObservationCreate.mockResolvedValue(OPEN_OBSERVATION);

    await createQuickObservation({ note: "note", matchId: "match-1", playerIds: ["p1", "p1", "p2"] }, orgFilter);

    expect(mockObservationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ playerIds: ["p1", "p2"] }) }),
    );
  });
});

describe("getQuickObservations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters by playerId in application code (playerIds is a JSON column)", async () => {
    mockObservationFindMany.mockResolvedValue([
      OPEN_OBSERVATION,
      { ...OPEN_OBSERVATION, id: "obs-2", playerIds: ["p3"] },
    ]);

    const result = await getQuickObservations({ playerId: "p3" }, orgFilter);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("obs-2");
  });
});

describe("discardQuickObservation / keepQuickObservationAsNote", () => {
  beforeEach(() => vi.clearAllMocks());

  it("discards an OPEN observation", async () => {
    mockObservationFindFirst.mockResolvedValue(OPEN_OBSERVATION);
    mockObservationUpdate.mockResolvedValue({ ...OPEN_OBSERVATION, status: "DISCARDED" });

    const result = await discardQuickObservation("obs-1", orgFilter);
    expect(result.status).toBe("DISCARDED");
  });

  it("refuses to discard an already-resolved observation", async () => {
    mockObservationFindFirst.mockResolvedValue({ ...OPEN_OBSERVATION, status: "CONVERTED" });
    await expect(discardQuickObservation("obs-1", orgFilter)).rejects.toThrow(/already been resolved/);
  });

  it("marks an OPEN observation as kept-as-note", async () => {
    mockObservationFindFirst.mockResolvedValue(OPEN_OBSERVATION);
    mockObservationUpdate.mockResolvedValue({ ...OPEN_OBSERVATION, status: "KEPT_AS_NOTE" });

    const result = await keepQuickObservationAsNote("obs-1", orgFilter);
    expect(result.status).toBe("KEPT_AS_NOTE");
  });
});

describe("convertQuickObservationToDevelopmentThread", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds the note as an observation on the given thread and marks the source converted", async () => {
    mockObservationFindFirst.mockResolvedValue(OPEN_OBSERVATION);
    mockAddObservation.mockResolvedValue({ id: "thread-obs-1" });
    mockObservationUpdate.mockResolvedValue({
      ...OPEN_OBSERVATION,
      status: "CONVERTED",
      convertedToType: "DEVELOPMENT_THREAD",
      convertedToId: "thread-obs-1",
    });

    const result = await convertQuickObservationToDevelopmentThread("obs-1", "thread-1", orgFilter);

    expect(mockAddObservation).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: "thread-1", evidence: OPEN_OBSERVATION.note, matchId: "match-1" }),
      orgFilter,
    );
    expect(result.status).toBe("CONVERTED");
    expect(result.convertedToType).toBe("DEVELOPMENT_THREAD");
  });
});

describe("convertQuickObservationToTeamReflection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("appends to an existing team reflection note rather than overwriting it", async () => {
    mockObservationFindFirst.mockResolvedValue(OPEN_OBSERVATION);
    mockGetTeamReflection.mockResolvedValue({ id: "reflection-1", note: "Existing note" });
    mockUpsertTeamReflection.mockResolvedValue({ id: "reflection-1" });
    mockObservationUpdate.mockResolvedValue({ ...OPEN_OBSERVATION, status: "CONVERTED", convertedToType: "TEAM_REFLECTION" });

    await convertQuickObservationToTeamReflection("obs-1", orgFilter);

    expect(mockUpsertTeamReflection).toHaveBeenCalledWith(
      expect.objectContaining({ note: `Existing note\n\n${OPEN_OBSERVATION.note}` }),
    );
  });

  it("rejects conversion when the observation has no match context", async () => {
    mockObservationFindFirst.mockResolvedValue({ ...OPEN_OBSERVATION, matchId: null });
    await expect(convertQuickObservationToTeamReflection("obs-1", orgFilter)).rejects.toThrow(/no match context/);
  });
});

describe("convertQuickObservationToOpponentObservation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects conversion when the match has no opponent team on record", async () => {
    mockObservationFindFirst.mockResolvedValue(OPEN_OBSERVATION);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", opponentTeamId: null });

    await expect(convertQuickObservationToOpponentObservation("obs-1", orgFilter)).rejects.toThrow(/no opponent team/);
  });

  it("rejects a note containing an email address", async () => {
    mockObservationFindFirst.mockResolvedValue({ ...OPEN_OBSERVATION, note: "Contact them at coach@rival.com" });
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", opponentTeamId: "opp-1" });

    await expect(convertQuickObservationToOpponentObservation("obs-1", orgFilter)).rejects.toThrow(/contact details or links/);
  });

  it("creates a new encounter observation with default assessment fields when none exists", async () => {
    mockObservationFindFirst.mockResolvedValue(OPEN_OBSERVATION);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", opponentTeamId: "opp-1" });
    mockEncounterFindUnique.mockResolvedValue(null);
    mockEncounterCreate.mockResolvedValue({ id: "encounter-1" });
    mockObservationUpdate.mockResolvedValue({ ...OPEN_OBSERVATION, status: "CONVERTED", convertedToType: "OPPONENT_OBSERVATION" });

    const result = await convertQuickObservationToOpponentObservation("obs-1", orgFilter);

    expect(mockEncounterCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ matchId: "match-1", opponentTeamId: "opp-1", factualSummary: OPEN_OBSERVATION.note }) }),
    );
    expect(result.convertedToType).toBe("OPPONENT_OBSERVATION");
  });

  it("appends to an existing encounter observation's factual summary", async () => {
    mockObservationFindFirst.mockResolvedValue(OPEN_OBSERVATION);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", opponentTeamId: "opp-1" });
    mockEncounterFindUnique.mockResolvedValue({ id: "encounter-1", factualSummary: "Physical, direct play.", recordedBy: null });
    mockEncounterUpdate.mockResolvedValue({ id: "encounter-1" });
    mockObservationUpdate.mockResolvedValue({ ...OPEN_OBSERVATION, status: "CONVERTED" });

    await convertQuickObservationToOpponentObservation("obs-1", orgFilter);

    expect(mockEncounterUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ factualSummary: `Physical, direct play.\n\n${OPEN_OBSERVATION.note}` }),
      }),
    );
  });
});
