import { getAppBaseUrl } from "../provider";
import { registerTemplate } from "./registry";

interface ReviewChangesRequestedData {
  organisationName: string;
  reviewerName: string;
  reviewerEmail: string;
  requesterName: string;
  requesterEmail: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  reviewerComment: string | null;
  reviewUrl: string;
  organisationSlug: string;
}

function renderReviewChangesRequested(data: Record<string, unknown>) {
  const d: ReviewChangesRequestedData = {
    organisationName: String(data.organisationName ?? ""),
    reviewerName: String(data.reviewerName ?? ""),
    reviewerEmail: String(data.reviewerEmail ?? ""),
    requesterName: String(data.requesterName ?? ""),
    requesterEmail: String(data.requesterEmail ?? ""),
    targetType: String(data.targetType ?? ""),
    targetId: String(data.targetId ?? ""),
    targetLabel: String(data.targetLabel ?? ""),
    reviewerComment: data.reviewerComment ? String(data.reviewerComment) : null,
    reviewUrl: String(data.reviewUrl ?? ""),
    organisationSlug: String(data.organisationSlug ?? ""),
  };

  const baseUrl = getAppBaseUrl();
  const reviewLink = d.reviewUrl.startsWith("http")
    ? d.reviewUrl
    : `${baseUrl}${d.reviewUrl}`;

  const subject = `Changes requested on your review — ${d.organisationName}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">Changes requested</h1>
    <p style="margin: 0 0 16px; color: #4a4a4a;">
      <strong>${escapeHtml(d.reviewerName)}</strong> has requested changes on your review on <strong>${escapeHtml(d.organisationName)}</strong>.
    </p>
    <p style="margin: 0 0 16px; color: #4a4a4a;">
      <strong>${escapeHtml(d.targetType)}</strong>: ${escapeHtml(d.targetLabel)}
    </p>
    ${d.reviewerComment ? `<p style="margin: 0 0 16px; color: #4a4a4a; font-style: italic;">"${escapeHtml(d.reviewerComment)}"</p>` : ""}
    <a href="${escapeHtml(reviewLink)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
      View details
    </a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">
    This notification was sent to ${escapeHtml(d.requesterEmail)}.
  </p>
</body>
</html>`;

  const textBody = [
    `Changes requested on your review — ${d.organisationName}`,
    "",
    `${d.reviewerName} has requested changes on your review.`,
    "",
    `${d.targetType}: ${d.targetLabel}`,
    d.reviewerComment ? `Comment: "${d.reviewerComment}"` : "",
    "",
    `View details: ${reviewLink}`,
    "",
    `This notification was sent to ${d.requesterEmail}.`,
  ].filter(Boolean).join("\n");

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

registerTemplate("REVIEW_CHANGES_REQUESTED", renderReviewChangesRequested);