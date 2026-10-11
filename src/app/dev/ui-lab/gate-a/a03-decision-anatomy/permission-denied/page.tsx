import Link from "next/link";
import { AppearanceControl } from "@/components/touchline";
import { minimalMatchTeamName, minimalMatchOpponentName } from "./fixtures";
import { buildDeniedCopy } from "./view-model";

/**
 * `/dev/ui-lab/gate-a/a03-decision-anatomy/permission-denied` — A03-S3. A denied actor sees only
 * the minimal match identity and the denial reason — never the squad, the pending starter, or the
 * unfilled slot (`03_INTERACTION_AND_POLICY_CONTRACT.md` "A03 state and feedback":
 * "`PERMISSION_DENIED` never displays another player's private detail"). No action control.
 */
export default function A03PermissionDeniedPage() {
  const copy = buildDeniedCopy();
  const matchReference = `${minimalMatchTeamName} vs ${minimalMatchOpponentName}`;

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a03-decision-anatomy" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A03 decision anatomy
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A03-S3 — Permission denied</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">{matchReference}</p>
      </div>

      <AppearanceControl />

      <div role="alert" className="rounded-lg border border-[var(--danger)] bg-[var(--danger-subtle)] p-4">
        <p className="text-[13px] font-[700] text-[var(--danger)]">Permission denied</p>
        <p className="mt-1 text-[13px] text-[var(--foreground)]">{copy.reason}</p>
      </div>
    </div>
  );
}
