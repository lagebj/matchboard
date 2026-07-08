'use server'

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireCoachAccess } from '@/lib/auth';
import { MatchReportStatus } from '@/generated/prisma/client';

export async function seedEventMatchReportAction(eventMatchId: string) {
  await requireCoachAccess();

  const eventMatch = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    include: {
      eventSquad: {
        include: { players: { include: { player: true } } },
      },
      supportAssignments: {
        include: {
          player: true,
          sourceEventSquad: { select: { name: true } },
        },
      },
    },
  });

  if (!eventMatch) throw new Error('Event match not found.');

  if (eventMatch.status === 'CANCELLED') {
    throw new Error('Cannot create report for cancelled match.');
  }

  const existingReport = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
  });

  if (existingReport) {
    throw new Error('Report already exists for this match.');
  }

  const squadPlayerIds = new Set(eventMatch.eventSquad.players.map((sp) => sp.playerId));
  const supportPlayerReports = eventMatch.supportAssignments
    .filter((sa) => !squadPlayerIds.has(sa.playerId))
    .map((sa) => ({
      playerId: sa.playerId,
      attendanceStatus: 'UNKNOWN' as const,
      role: `Planned helper from ${sa.sourceEventSquad.name}`,
    }));

  const report = await db.eventPostMatchReport.create({
    data: {
      eventMatchId,
      status: 'DRAFT',
      playerReports: {
        create: [
          ...eventMatch.eventSquad.players.map((sp) => ({
            playerId: sp.playerId,
            attendanceStatus: 'UNKNOWN' as const,
          })),
          ...supportPlayerReports,
        ],
      },
    },
    include: {
      playerReports: true,
      goalEvents: true,
      assistEvents: true,
    },
  });

  revalidatePath(`/events/${eventMatch.eventId}`);
  return report;
}

export async function getEventMatchReport(eventMatchId: string) {
  await requireCoachAccess();

  const report = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
    include: {
      playerReports: { include: { player: true } },
      goalEvents: { include: { scorer: true } },
      assistEvents: { include: { assist: true } },
    },
  });

  return report;
}

export async function updateEventMatchResultAction(
  reportId: string,
  data: { ourScore?: number; opponentScore?: number; teamReflection?: string; opponentObservation?: string; notes?: string },
) {
  await requireCoachAccess();

  const report = await db.eventPostMatchReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('Report not found.');

  if (report.status === 'LOCKED') {
    throw new Error('Cannot update a locked report.');
  }

  const updated = await db.eventPostMatchReport.update({
    where: { id: reportId },
    data: {
      ...(data.ourScore !== undefined ? { ourScore: data.ourScore } : {}),
      ...(data.opponentScore !== undefined ? { opponentScore: data.opponentScore } : {}),
      ...(data.teamReflection !== undefined ? { teamReflection: data.teamReflection } : {}),
      ...(data.opponentObservation !== undefined ? { opponentObservation: data.opponentObservation } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
  });

  const eventMatch = await db.eventMatch.findUnique({ where: { id: report.eventMatchId } });
  if (eventMatch) {
    revalidatePath(`/events/${eventMatch.eventId}`);
  }
  return updated;
}

export async function updateEventPlayerAttendanceAction(
  playerReportId: string,
  attendanceStatus: string,
) {
  await requireCoachAccess();

  const playerReport = await db.eventPostMatchPlayer.findUnique({
    where: { id: playerReportId },
    include: { report: true },
  });

  if (!playerReport) throw new Error('Player report not found.');
  if (playerReport.report.status === 'LOCKED') {
    throw new Error('Cannot update attendance on a locked report.');
  }

  const updated = await db.eventPostMatchPlayer.update({
    where: { id: playerReportId },
    data: { attendanceStatus },
  });

  const eventMatch = await db.eventMatch.findUnique({
    where: { id: playerReport.report.eventMatchId },
  });
  if (eventMatch) {
    revalidatePath(`/events/${eventMatch.eventId}`);
  }
  return updated;
}

export async function addEventGoalAction(
  reportId: string,
  data: { playerId?: string; minute?: number; type?: string; note?: string },
) {
  await requireCoachAccess();

  const report = await db.eventPostMatchReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('Report not found.');
  if (report.status === 'LOCKED') {
    throw new Error('Cannot add goals to a locked report.');
  }

  const goal = await db.eventGoalEvent.create({
    data: {
      reportId,
      playerId: data.playerId || null,
      minute: data.minute ?? null,
      type: data.type || 'NORMAL',
      note: data.note || null,
    },
  });

  const eventMatch = await db.eventMatch.findUnique({ where: { id: report.eventMatchId } });
  if (eventMatch) {
    revalidatePath(`/events/${eventMatch.eventId}`);
  }
  return goal;
}

export async function removeEventGoalAction(goalId: string) {
  await requireCoachAccess();

  const goal = await db.eventGoalEvent.findUnique({ where: { id: goalId } });
  if (!goal) throw new Error('Goal not found.');

  const report = await db.eventPostMatchReport.findUnique({ where: { id: goal.reportId } });
  if (report?.status === 'LOCKED') {
    throw new Error('Cannot remove goals from a locked report.');
  }

  await db.eventGoalEvent.delete({ where: { id: goalId } });

  if (report) {
    const eventMatch = await db.eventMatch.findUnique({ where: { id: report.eventMatchId } });
    if (eventMatch) {
      revalidatePath(`/events/${eventMatch.eventId}`);
    }
  }
  return { success: true };
}

export async function addEventAssistAction(
  reportId: string,
  data: { playerId: string; type?: string },
) {
  await requireCoachAccess();

  const report = await db.eventPostMatchReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('Report not found.');
  if (report.status === 'LOCKED') {
    throw new Error('Cannot add assists to a locked report.');
  }

  const assist = await db.eventAssistEvent.create({
    data: {
      reportId,
      playerId: data.playerId,
      type: data.type || 'NORMAL',
    },
  });

  const eventMatch = await db.eventMatch.findUnique({ where: { id: report.eventMatchId } });
  if (eventMatch) {
    revalidatePath(`/events/${eventMatch.eventId}`);
  }
  return assist;
}

export async function removeEventAssistAction(assistId: string) {
  await requireCoachAccess();

  const assist = await db.eventAssistEvent.findUnique({ where: { id: assistId } });
  if (!assist) throw new Error('Assist not found.');

  const report = await db.eventPostMatchReport.findUnique({ where: { id: assist.reportId } });
  if (report?.status === 'LOCKED') {
    throw new Error('Cannot remove assists from a locked report.');
  }

  await db.eventAssistEvent.delete({ where: { id: assistId } });

  if (report) {
    const eventMatch = await db.eventMatch.findUnique({ where: { id: report.eventMatchId } });
    if (eventMatch) {
      revalidatePath(`/events/${eventMatch.eventId}`);
    }
  }
  return { success: true };
}

export async function completeEventMatchReportAction(reportId: string) {
  await requireCoachAccess();

  const report = await db.eventPostMatchReport.findUnique({
    where: { id: reportId },
    include: { playerReports: true },
  });

  if (!report) throw new Error('Report not found.');

  if (report.status === 'LOCKED') {
    throw new Error('Report is already completed.');
  }

  const unknownAttendance = report.playerReports.some(
    (pr) => pr.attendanceStatus === 'UNKNOWN',
  );

  if (unknownAttendance) {
    throw new Error('Cannot complete report: some players have unknown attendance. Mark all players as Present, No show, or absent.');
  }

  const updated = await db.eventPostMatchReport.update({
    where: { id: reportId },
    data: {
      status: 'LOCKED',
      completedAt: new Date(),
    },
  });

  const eventMatch = await db.eventMatch.findUnique({ where: { id: report.eventMatchId } });
  if (eventMatch) {
    revalidatePath(`/events/${eventMatch.eventId}`);
  }
  return updated;
}

export async function reopenEventMatchReportAction(reportId: string, targetStatus?: 'DRAFT' | 'REPORTED') {
  await requireCoachAccess();

  const report = await db.eventPostMatchReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error('Report not found.');

  if (report.status === 'DRAFT') {
    throw new Error('Report is already in DRAFT status.');
  }

  const newStatus: MatchReportStatus = targetStatus === 'REPORTED' ? 'REPORTED' : 'DRAFT';

  const updated = await db.eventPostMatchReport.update({
    where: { id: reportId },
    data: {
      status: newStatus,
      completedAt: null,
    },
  });

  const eventMatch = await db.eventMatch.findUnique({ where: { id: report.eventMatchId } });
  if (eventMatch) {
    revalidatePath(`/events/${eventMatch.eventId}`);
  }
  return updated;
}