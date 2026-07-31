"use client";

import { useState } from "react";
import { acceptInvitationAction } from "@/app/(app)/organisations/actions";

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
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

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

  if (accepted) {
    return (
      <div className="rounded-md border border-[var(--border-soft)] p-4">
        <p className="text-sm font-medium">Invitation accepted!</p>
        <p className="text-xs text-muted-foreground mt-1">
          Redirecting to {organisationName}...
        </p>
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
          disabled={isAccepting}
          className="rounded-md bg-[var(--surface-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-3)] disabled:opacity-50"
        >
          {isAccepting ? "Accepting..." : "Accept Invitation"}
        </button>
        <a
          href="/organisations"
          className="rounded-md border border-[var(--border-soft)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)]"
        >
          Decline
        </a>
      </div>
    </div>
  );
}