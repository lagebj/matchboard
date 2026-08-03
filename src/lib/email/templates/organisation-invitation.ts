import { getAppBaseUrl } from "../provider";
import { registerTemplate } from "./registry";

interface OrganisationInvitationData {
  organisationName: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: string;
  acceptUrl: string;
  organisationSlug: string;
}

function renderOrganisationInvitation(data: Record<string, unknown>) {
  const d: OrganisationInvitationData = {
    organisationName: String(data.organisationName ?? ""),
    inviterName: String(data.inviterName ?? ""),
    inviterEmail: String(data.inviterEmail ?? ""),
    inviteeEmail: String(data.inviteeEmail ?? ""),
    role: String(data.role ?? ""),
    acceptUrl: String(data.acceptUrl ?? ""),
    organisationSlug: String(data.organisationSlug ?? ""),
  };

  const baseUrl = getAppBaseUrl();
  const acceptLink = d.acceptUrl.startsWith("http")
    ? d.acceptUrl
    : `${baseUrl}${d.acceptUrl}`;

  const subject = `${d.inviterName} invited you to join ${d.organisationName} on Matchboard`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">You're invited to join ${escapeHtml(d.organisationName)}</h1>
    <p style="margin: 0 0 16px; color: #4a4a4a;">
      <strong>${escapeHtml(d.inviterName)}</strong> (${escapeHtml(d.inviterEmail)}) has invited you to join <strong>${escapeHtml(d.organisationName)}</strong> on Matchboard as <strong>${escapeHtml(d.role)}</strong>.
    </p>
    <a href="${escapeHtml(acceptLink)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
      Accept invitation
    </a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">
    This invitation was sent to ${escapeHtml(d.inviteeEmail)}. If you did not expect this email, you can safely ignore it.
  </p>
</body>
</html>`;

  const textBody = [
    `You're invited to join ${d.organisationName}`,
    "",
    `${d.inviterName} (${d.inviterEmail}) has invited you to join ${d.organisationName} on Matchboard as ${d.role}.`,
    "",
    `Accept the invitation: ${acceptLink}`,
    "",
    `This invitation was sent to ${d.inviteeEmail}. If you did not expect this email, you can safely ignore it.`,
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

registerTemplate("ORGANISATION_INVITATION", renderOrganisationInvitation);