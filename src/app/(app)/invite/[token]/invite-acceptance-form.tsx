"use client";

import { useState } from "react";
import { acceptInvitationAction, declineInvitationAction } from "@/app/(app)/organisations/actions";
import { useAnotherAccountAction } from "./invite-account-actions";
import { TouchlineButton } from "@/components/touchline";

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
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  const isBusy = isAccepting || isDeclining || isSwitchingAccount;

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

  async function handleUseAnotherAccount() {
    setIsSwitchingAccount(true);
    setError(null);
    // useAnotherAccountAction redirects on success (it never resolves normally), so no
    // success-path state update is needed here -- only the (unlikely) failure path is.
    try {
      await useAnotherAccountAction(token);
    } catch {
      setError("Could not switch accounts. Please try again.");
      setIsSwitchingAccount(false);
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
        <p className="text-sm text-[var(--danger)]">{error}</p>
      )}
      <div className="flex flex-wrap gap-3">
        <TouchlineButton variant="primary" onClick={handleAccept} disabled={isBusy}>
          {isAccepting ? "Accepting..." : "Accept invitation"}
        </TouchlineButton>
        <TouchlineButton variant="secondary" onClick={handleDecline} disabled={isBusy}>
          {isDeclining ? "Declining..." : "Decline"}
        </TouchlineButton>
      </div>
      <TouchlineButton variant="ghost" fullWidth onClick={handleUseAnotherAccount} disabled={isBusy}>
        {isSwitchingAccount ? "Switching account..." : "Use another account"}
      </TouchlineButton>
    </div>
  );
}
