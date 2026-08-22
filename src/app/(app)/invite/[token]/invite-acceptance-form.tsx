"use client";

import { useState } from "react";
import { acceptInvitationAction, declineInvitationAction } from "@/app/(app)/organisations/actions";

export function InviteAcceptanceForm({
  token,
  organisationName,
  organisationSlug,
}: {
  token: string;
  organisationName: string;
  organisationSlug: string;
}) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  async function handleAccept() {
    setIsAccepting(true);
    setError(null);

    const result = await acceptInvitationAction(token);

    if (result.success) {
      setAccepted(true);
      setTimeout(() => {
        window.location.href = `/o/${organisationSlug}`;
      }, 1500);
    } else {
      setError(result.error);
      setIsAccepting(false);
    }
  }

  async function handleDecline() {
    setIsDeclining(true);
    setError(null);

    const result = await declineInvitationAction(token);

    if (result.success) {
      setDeclined(true);
    } else {
      setError(result.error);
      setIsDeclining(false);
    }
  }

  if (accepted) {
    return (
      <div className="rounded-md border border-[var(--border-soft)] p-4">
        <p className="text-sm font-medium">Invitation accepted!</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Redirecting to {organisationName}...
        </p>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="rounded-md border border-[var(--border-soft)] p-4">
        <p className="text-sm font-medium">Invitation declined</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          You can request a new invitation if you change your mind.
        </p>
        <a
          href="/organisations"
          className="mt-3 inline-block text-sm text-[var(--accent-strong)] hover:underline"
        >
          View organisations
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={handleAccept}
          disabled={isAccepting || isDeclining}
          className="rounded-md bg-[var(--surface-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          {isAccepting ? "Accepting..." : "Accept Invitation"}
        </button>
        <button
          onClick={handleDecline}
          disabled={isAccepting || isDeclining}
          className="rounded-md border border-[var(--border-soft)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50"
        >
          {isDeclining ? "Declining..." : "Decline"}
        </button>
      </div>
    </div>
  );
}