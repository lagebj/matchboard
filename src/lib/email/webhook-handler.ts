import crypto from "crypto";
import { db } from "@/lib/db";

interface BrevoWebhookEvent {
  event: string;
  email: string;
  id: number;
  date: string;
  "message-id"?: string;
  subject?: string;
  tag?: string;
  [key: string]: unknown;
}

export async function processBrevoWebhookEvents(
  events: BrevoWebhookEvent[],
): Promise<{ processed: number; skipped: number }> {
  let processed = 0;
  let skipped = 0;

  for (const event of events) {
    const eventId = String(event.id);

    const existing = await db.providerWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existing) {
      skipped++;
      continue;
    }

    const eventType = event.event ?? "unknown";
    const providerMessageId = event["message-id"];
    const recipientEmail = event.email;

    await db.providerWebhookEvent.create({
      data: {
        provider: "brevo",
        eventId,
        eventType,
        providerMessageId: providerMessageId ?? null,
        recipientEmail: recipientEmail ?? null,
        payload: event as unknown as Record<string, unknown> as any,
        processed: false,
      },
    });

    if (providerMessageId && recipientEmail) {
      await updateDeliveryStatus(providerMessageId, eventType, recipientEmail);
    }

    await db.providerWebhookEvent.update({
      where: { eventId },
      data: { processed: true, processedAt: new Date() },
    });

    processed++;
  }

  return { processed, skipped };
}

async function updateDeliveryStatus(
  providerMessageId: string,
  eventType: string,
  recipientEmail: string,
): Promise<void> {
  const delivery = await db.notificationDelivery.findFirst({
    where: {
      providerMessageId,
      recipientEmail,
    },
  });

  if (!delivery) return;

  const statusUpdate: Record<string, unknown> = {};

  switch (eventType) {
    case "delivered":
      statusUpdate.status = "DELIVERED";
      statusUpdate.deliveredAt = new Date();
      break;
    case "hard_bounce":
    case "soft_bounce":
    case "blocked":
    case "invalid_email":
    case "error":
      statusUpdate.status = "BOUNCED";
      statusUpdate.bouncedAt = new Date();
      statusUpdate.bouncedReason = eventType;
      break;
    case "complaint":
      statusUpdate.status = "COMPLAINED";
      break;
    case "opened":
    case "uniqueOpened":
      statusUpdate.status = "OPENED";
      break;
    case "click":
      statusUpdate.status = "CLICKED";
      break;
    case "request":
      break;
    default:
      break;
  }

  if (Object.keys(statusUpdate).length > 0) {
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: statusUpdate,
    });
  }
}

export { type BrevoWebhookEvent };