'use client'

import { createPlayerLockAction, removePlayerLockAction } from "@/app/locks/actions";

type LockToggleFormProps = {
  lockId: string;
  matchRoundId: string;
  playerId: string;
  currentLockType: "LOCKED_IN" | "LOCKED_OUT";
};

export function LockToggleForm({
  lockId,
  matchRoundId,
  playerId,
  currentLockType,
}: LockToggleFormProps) {
  async function handleSwitchToOut() {
    await createPlayerLockAction(matchRoundId, playerId, "LOCKED_OUT", "");
  }

  async function handleSwitchToIn() {
    await createPlayerLockAction(matchRoundId, playerId, "LOCKED_IN", "");
  }

  async function handleRemove() {
    await removePlayerLockAction(lockId);
  }

  return (
    <span className="inline-flex gap-1">
      {currentLockType === "LOCKED_IN" ? (
        <form action={handleSwitchToOut}>
          <button
            className="rounded-full border border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.08)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#f0cbc5] hover:bg-[rgba(185,128,119,0.14)]"
            type="submit"
          >
            Switch to out
          </button>
        </form>
      ) : (
        <form action={handleSwitchToIn}>
          <button
            className="rounded-full border border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.08)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-strong)] hover:bg-[rgba(140,167,146,0.14)]"
            type="submit"
          >
            Switch to in
          </button>
        </form>
      )}
      <form action={handleRemove}>
        <button
          className="rounded-full border app-hairline bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] app-copy-soft hover:bg-[rgba(255,255,255,0.06)]"
          type="submit"
        >
          Remove lock
        </button>
      </form>
    </span>
  );
}