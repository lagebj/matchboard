import { db } from "@/lib/db";
import type { PrismaClient, NotificationTemplate, NotificationStatus, Prisma } from "@/generated/prisma/client";
import { getEmailProvider } from "./provider-factory";
import { renderTemplate } from "./templates/index";
import { logNotificationSent } from "@/lib/security/audit-log";

const RETRY_BASE_DELAY_MS = 60_000;
const MAX_AGE_HOURS = 72;
const BATCH_SIZE = 25;

interface EnqueueNotificationInput {
  organisationId: string;
  idempotencyKey?: string;
  template: NotificationTemplate;
  payload: Record<string, unknown>;
  recipientEmail: string;
  recipientUserId?: string;
}

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

export async function enqueueNotification(
  input: EnqueueNotificationInput,
  tx?: TransactionClient,
): Promise<string> {
  const client = tx ?? db;

  if (input.idempotencyKey) {
    const existing = await client.notificationOutbox.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
  }

  const outbox = await client.notificationOutbox.create({
    data: {
      organisationId: input.organisationId,
      idempotencyKey: input.idempotencyKey,
      template: input.template,
      payload: input.payload as Prisma.InputJsonValue,
      status: "PENDING" as NotificationStatus,
    },
  });

  await client.notificationDelivery.create({
    data: {
      outboxId: outbox.id,
      recipientEmail: input.recipientEmail,
      recipientUserId: input.recipientUserId,
      status: "QUEUED",
    },
  });

  return outbox.id;
}

export async function enqueueAndSendNotification(
  input: EnqueueNotificationInput,
  tx?: TransactionClient,
): Promise<{ outboxId: string; sendResult: { success: boolean; error?: string } }> {
  const outboxId = await enqueueNotification(input, tx);

  const sendResult = await sendNotificationNow(outboxId);

  return { outboxId, sendResult };
}

export async function processOutboxBatch(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
}> {
  const now = new Date();
  const maxAge = new Date(now.getTime() - MAX_AGE_HOURS * 60 * 60 * 1000);

  const pending = await db.notificationOutbox.findMany({
    where: {
      status: { in: ["PENDING" as NotificationStatus, "PROCESSING" as NotificationStatus] },
      scheduledAt: { lte: now },
      createdAt: { gte: maxAge },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } },
      ],
    },
    include: { deliveries: true },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_SIZE,
  });

  let succeeded = 0;
  let failed = 0;
  let retried = 0;

  for (const entry of pending) {
    if (entry.retryCount >= entry.maxRetries) {
      await db.notificationOutbox.update({
        where: { id: entry.id },
        data: { status: "FAILED" as NotificationStatus },
      });
      failed++;
      continue;
    }

    await db.notificationOutbox.update({
      where: { id: entry.id },
      data: { status: "PROCESSING" as NotificationStatus },
    });

    try {
      const templateData = renderTemplate(entry.template, entry.payload as Record<string, unknown>);

      const provider = getEmailProvider();
      const result = await provider.send({
        to: entry.deliveries.map((d) => ({
          email: d.recipientEmail,
        })),
        subject: templateData.subject,
        htmlBody: templateData.htmlBody,
        textBody: templateData.textBody,
        tags: { template: entry.template, organisationId: entry.organisationId ?? "none" },
      });

      if (result.success) {
        await db.notificationOutbox.update({
          where: { id: entry.id },
          data: {
            status: "SENT" as NotificationStatus,
            processedAt: new Date(),
          },
        });

        if (result.providerMessageId) {
          await db.notificationDelivery.updateMany({
            where: { outboxId: entry.id },
            data: {
              status: "SENT",
              providerMessageId: result.providerMessageId,
              sentAt: new Date(),
            },
          });
        } else {
          await db.notificationDelivery.updateMany({
            where: { outboxId: entry.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
            },
          });
        }

        succeeded++;
        logNotificationSent("cron", entry.id, "success");
      } else {
        const nextRetryAt = new Date(
          now.getTime() + RETRY_BASE_DELAY_MS * Math.pow(2, entry.retryCount),
        );

        await db.notificationOutbox.update({
          where: { id: entry.id },
          data: {
            status: "PENDING" as NotificationStatus,
            retryCount: entry.retryCount + 1,
            nextRetryAt,
          },
        });

        retried++;
        console.warn(
          `[outbox] Failed to send notification ${entry.id}: ${result.error}. Retry ${entry.retryCount + 1}/${entry.maxRetries}.`,
        );
      }
    } catch (err) {
      const nextRetryAt = new Date(
        now.getTime() + RETRY_BASE_DELAY_MS * Math.pow(2, entry.retryCount),
      );

      await db.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          status: "PENDING" as NotificationStatus,
          retryCount: entry.retryCount + 1,
          nextRetryAt,
        },
      });

      retried++;
      console.error(`[outbox] Error processing notification ${entry.id}:`, err);
    }
  }

  return {
    processed: pending.length,
    succeeded,
    failed,
    retried,
  };
}

export async function sendNotificationNow(outboxId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const entry = await db.notificationOutbox.findUnique({
    where: { id: outboxId },
    include: { deliveries: true },
  });

  if (!entry) {
    return { success: false, error: "Notification not found" };
  }

  if (entry.status !== "PENDING" && entry.status !== "PROCESSING") {
    return { success: false, error: `Notification already in status ${entry.status}` };
  }

  await db.notificationOutbox.update({
    where: { id: entry.id },
    data: { status: "PROCESSING" as NotificationStatus },
  });

  try {
    const templateData = renderTemplate(entry.template, entry.payload as Record<string, unknown>);

    const provider = getEmailProvider();
    const result = await provider.send({
      to: entry.deliveries.map((d) => ({
        email: d.recipientEmail,
      })),
      subject: templateData.subject,
      htmlBody: templateData.htmlBody,
      textBody: templateData.textBody,
      tags: { template: entry.template, organisationId: entry.organisationId },
    });

    if (result.success) {
      await db.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          status: "SENT" as NotificationStatus,
          processedAt: new Date(),
        },
      });

      if (result.providerMessageId) {
        await db.notificationDelivery.updateMany({
          where: { outboxId: entry.id },
          data: {
            status: "SENT",
            providerMessageId: result.providerMessageId,
            sentAt: new Date(),
          },
        });
      } else {
        await db.notificationDelivery.updateMany({
          where: { outboxId: entry.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
      }

      logNotificationSent("immediate", entry.id, "success");

      return { success: true };
    } else {
      await db.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          status: "PENDING" as NotificationStatus,
          retryCount: entry.retryCount + 1,
          nextRetryAt: new Date(Date.now() + RETRY_BASE_DELAY_MS * Math.pow(2, entry.retryCount)),
        },
      });

      console.warn(`[outbox] Immediate send failed for ${entry.id}: ${result.error}. Will retry via cron.`);

      return { success: false, error: result.error };
    }
  } catch (err) {
    await db.notificationOutbox.update({
      where: { id: entry.id },
      data: {
        status: "PENDING" as NotificationStatus,
        retryCount: entry.retryCount + 1,
        nextRetryAt: new Date(Date.now() + RETRY_BASE_DELAY_MS * Math.pow(2, entry.retryCount)),
      },
    });

    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[outbox] Immediate send error for ${entry.id}:`, err);

    return { success: false, error: message };
  }
}

export async function cancelNotification(outboxId: string): Promise<boolean> {
  const entry = await db.notificationOutbox.findUnique({ where: { id: outboxId } });
  if (!entry) return false;

  if (entry.status === "SENT") return false;

  await db.notificationOutbox.update({
    where: { id: outboxId },
    data: { status: "CANCELLED" as NotificationStatus },
  });

  return true;
}

export async function cancelNotificationByIdempotencyKey(idempotencyKey: string): Promise<boolean> {
  const entry = await db.notificationOutbox.findUnique({ where: { idempotencyKey } });
  if (!entry) return false;

  if (entry.status === "SENT") return false;

  await db.notificationOutbox.update({
    where: { id: entry.id },
    data: { status: "CANCELLED" as NotificationStatus },
  });

  return true;
}