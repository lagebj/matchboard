import { getAppBaseUrl } from "../provider";
import { registerTemplate } from "./registry";

interface OwnershipHandoverRequestedData {
  organisationName: string;
  assignerName: string;
  assignerEmail: string;
  assigneeName: string;
  assigneeEmail: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  ownershipUrl: string;
  organisationSlug: string;
}

function renderOwnershipHandoverRequested(data: Record<string, unknown>) {
  const d: OwnershipHandoverRequestedData = {
    organisationName: String(data.organisationName ?? ""),
    assignerName: String(data.assignerName ?? ""),
    assignerEmail: String(data.assignerEmail ?? ""),
    assigneeName: String(data.assigneeName ?? ""),
    assigneeEmail: String(data.assigneeEmail ?? ""),
    targetType: String(data.targetType ?? ""),
    targetId: String(data.targetId ?? ""),
    targetLabel: String(data.targetLabel ?? ""),
    ownershipUrl: String(data.ownershipUrl ?? ""),
    organisationSlug: String(data.organisationSlug ?? ""),
  };

  const baseUrl = getAppBaseUrl();
  const ownershipLink = d.ownershipUrl.startsWith("http")
    ? d.ownershipUrl
    : `${baseUrl}${d.ownershipUrl}`;

  const subject = `Ownership handover requested on ${d.organisationName}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">Ownership handover requested</h1>
    <p style="margin: 0 0 16px; color: #4a4a4a;">
      <strong>${escapeHtml(d.assignerName)}</strong> (${escapeHtml(d.assignerEmail)}) has requested you take over ownership of a work item on <strong>${escapeHtml(d.organisationName)}</strong>.
    </p>
    <p style="margin: 0 0 16px; color: #4a4a4a;">
      <strong>${escapeHtml(d.targetType)}</strong>: ${escapeHtml(d.targetLabel)}
    </p>
    <a href="${escapeHtml(ownershipLink)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
      View details
    </a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">
    This notification was sent to ${escapeHtml(d.assigneeEmail)}.
  </p>
</body>
</html>`;

  const textBody = [
    `Ownership handover requested on ${d.organisationName}`,
    "",
    `${d.assignerName} (${d.assignerEmail}) has requested you take over ownership.`,
    "",
    `${d.targetType}: ${d.targetLabel}`,
    "",
    `View details: ${ownershipLink}`,
    "",
    `This notification was sent to ${d.assigneeEmail}.`,
  ].join("\n");

  return { subject, htmlBody, textBody };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

registerTemplate("OWNERSHIP_HANDOVER_REQUESTED", renderOwnershipHandoverRequested);