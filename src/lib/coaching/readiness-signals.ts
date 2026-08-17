import { db } from "@/lib/db";
import {
  type ReadinessSignalType,
  type ReadinessSignalValue,
  READINESS_SIGNAL_TYPES,
  READINESS_SIGNAL_VALID_VALUES,
} from "./types";

type CreateReadinessSignalInput = {
  playerId: string;
  signalType: ReadinessSignalType;
  value: ReadinessSignalValue;
  note?: string;
  recordedBy?: string;
  organisationId: string;
};

type UpdateReadinessSignalInput = {
  value?: ReadinessSignalValue;
  note?: string;
};

export function validateSignalType(signalType: string): signalType is ReadinessSignalType {
  return READINESS_SIGNAL_TYPES.includes(signalType as ReadinessSignalType);
}

export function validateSignalValue(signalType: ReadinessSignalType, value: string): value is ReadinessSignalValue {
  const validValues = READINESS_SIGNAL_VALID_VALUES[signalType];
  if (!validValues) return false;
  return validValues.includes(value as ReadinessSignalValue);
}

export function isValidSignalValueForType(signalType: ReadinessSignalType, value: ReadinessSignalValue): boolean {
  const validValues = READINESS_SIGNAL_VALID_VALUES[signalType];
  return validValues?.includes(value) ?? false;
}

export async function setReadinessSignal(input: CreateReadinessSignalInput) {
  if (!validateSignalType(input.signalType)) {
    throw new Error(`Invalid readiness signal type: ${input.signalType}`);
  }
  if (!validateSignalValue(input.signalType, input.value)) {
    const validValues = READINESS_SIGNAL_VALID_VALUES[input.signalType];
    throw new Error(
      `Invalid value "${input.value}" for signal type "${input.signalType}". Valid values: ${validValues.join(", ")}`
    );
  }

  return db.playerReadinessSignal.upsert({
    where: {
      playerId_signalType: {
        playerId: input.playerId,
        signalType: input.signalType,
      },
    },
    create: {
      organisationId: input.organisationId,
      playerId: input.playerId,
      signalType: input.signalType,
      value: input.value,
      note: input.note,
      recordedBy: input.recordedBy,
    },
    update: {
      value: input.value,
      note: input.note,
      recordedBy: input.recordedBy ?? undefined,
    },
  });
}

export async function updateReadinessSignal(id: string, input: UpdateReadinessSignalInput) {
  if (input.value !== undefined) {
    const existing = await db.playerReadinessSignal.findFirst({ where: { id } });
    if (!existing) throw new Error(`Readiness signal not found: ${id}`);
    if (!validateSignalValue(existing.signalType as ReadinessSignalType, input.value)) {
      const validValues = READINESS_SIGNAL_VALID_VALUES[existing.signalType as ReadinessSignalType];
      throw new Error(
        `Invalid value "${input.value}" for signal type "${existing.signalType}". Valid values: ${validValues.join(", ")}`
      );
    }
  }

  return db.playerReadinessSignal.update({
    where: { id },
    data: {
      ...(input.value !== undefined && { value: input.value }),
      ...(input.note !== undefined && { note: input.note }),
    },
  });
}

export async function getReadinessSignalsForPlayer(playerId: string) {
  return db.playerReadinessSignal.findMany({
    where: { playerId },
    orderBy: { signalType: "asc" },
  });
}

export async function getAllReadinessSignals() {
  return db.playerReadinessSignal.findMany({
    orderBy: [{ playerId: "asc" }, { signalType: "asc" }],
  });
}

export async function deleteReadinessSignal(id: string) {
  return db.playerReadinessSignal.delete({ where: { id } });
}

export function isNegativeReadinessSignal(signalType: ReadinessSignalType, value: ReadinessSignalValue): boolean {
  const negativeValues: ReadinessSignalValue[] = ["FALLING", "LOW", "NEEDS_ATTENTION"];
  return negativeValues.includes(value);
}

export function getReadinessWarningsForPlayer(signals: { signalType: ReadinessSignalType; value: ReadinessSignalValue }[]): string[] {
  const warnings: string[] = [];

  for (const signal of signals) {
    if (isNegativeReadinessSignal(signal.signalType, signal.value)) {
      switch (signal.signalType) {
        case "EFFORT_TREND":
          warnings.push("Effort trend is falling — may affect selection preference");
          break;
        case "ATTENDANCE_RELIABILITY":
          warnings.push("Attendance reliability is low — may impact planning");
          break;
        case "LEARNING_BEHAVIOR":
          warnings.push("Learning behavior needs attention — consider development focus");
          break;
        case "TEAM_FIRST_BEHAVIOR":
          warnings.push("Team-first behavior needs attention — may prefer individual options");
          break;
        case "RESET_AFTER_ERROR_RELIABILITY":
          warnings.push("Reset-after-error reliability needs attention — consider confidence rebuild");
          break;
        case "COACH_TRUST":
          warnings.push("Coach trust is low — review context before assigning critical roles");
          break;
      }
    }
  }

  return warnings;
}