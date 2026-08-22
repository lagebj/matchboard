import { db } from "@/lib/db";
import type { PrismaClient, NotificationTemplate, NotificationStatus, Prisma } from "@/generated/prisma/client";
import { getEmailProvider } from "./provider-factory";
import { renderTemplate } from "./templates/index";
import { logNotificationSent } from "@/lib/security/audit-log";
import { isTest } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { SendEmailRequest } from "./provider";

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

// Observability safeguard per the consolidation programme's Brevo-correlation requirement — not
// a security boundary (BREVO_TEST_RECIPIENTS' fail-closed allowlist is that). "PR"/"test run"
// tags aren't included: this runs from live application request handling, not a CI job, so
// there's no PR/run context available to attach truthfully.
function buildOutboundEmail(
  templateData: { subject: string; htmlBody: string; textBody: string },
  recipients: { email: string }[],
  template: NotificationTemplate,
  organisationId: string,
): Pick<SendEmailRequest, "subject" | "htmlBody" | "textBody" | "tags"> {
  const subject = isTest() ? `[TEST] ${templateData.subject}` : templateData.subject;
  return {
    subject,
    htmlBody: templateData.htmlBody,
    textBody: templateData.textBody,
    tags: {
      template,
      organisationId,
      environment: process.env.MATCHBOARD_ENV ?? "development",
      recipient: recipients[0]?.email ?? "none",
    },
  };
}

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
      const recipients = entry.deliveries.map((d) => ({ email: d.recipientEmail }));

      const provider = getEmailProvider();
      const result = await provider.send({
        to: recipients,
        ...buildOutboundEmail(templateData, recipients, entry.template, entry.organisationId),
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
        logger.warn(
          { notificationId: entry.id, error: result.error, retryCount: entry.retryCount + 1, maxRetries: entry.maxRetries },
          "[outbox] Failed to send notification",
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
      logger.error({ notificationId: entry.id, err }, "[outbox] Error processing notification");
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
    const recipients = entry.deliveries.map((d) => ({ email: d.recipientEmail }));

    const provider = getEmailProvider();
    const result = await provider.send({
      to: recipients,
      ...buildOutboundEmail(templateData, recipients, entry.template, entry.organisationId),
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

      logger.warn({ notificationId: entry.id, error: result.error }, "[outbox] Immediate send failed. Will retry via cron.");

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
    logger.error({ notificationId: entry.id, err }, "[outbox] Immediate send error");

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