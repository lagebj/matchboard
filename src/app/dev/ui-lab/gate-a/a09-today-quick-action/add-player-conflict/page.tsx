"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useFixtureOperation, useDirtyCloseGuard } from "../../shared/fixture-operation";
import { TodayQuickActionInspector, TodayQuickActionSheet, type TodayQuickActionSuccess } from "../shared/today-quick-action-sheet";
import { matchW3Identity, MATCH_W3_TEAM_NAME, MATCH_W3_OPPONENT_NAME, MATCH_W3_ROUND_LABEL, MATCH_W3_CURRENT_SQUAD_SIZE, MATCH_W3_TARGET_SQUAD_SIZE } from "../../shared/match-w3-fixture";
import { candidate, conflictOutcome } from "./view-model";

const MATCH_REFERENCE = `${MATCH_W3_TEAM_NAME} vs ${MATCH_W3_OPPONENT_NAME} — ${MATCH_W3_ROUND_LABEL}`;

/**
 * `/dev/ui-lab/gate-a/a09-today-quick-action/add-player-conflict` — A09-S5. Another coach already
 * added Felix; the predeclared `CONFLICT` outcome carries explicit expected/current revisions.
 * No duplicate add, no auto-merge, draft preserved for recheck.
 */
export default function AddPlayerConflictPage() {
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const op = useFixtureOperation<number, { candidateId: string }, TodayQuickActionSuccess>(MATCH_W3_CURRENT_SQUAD_SIZE, (authoritative) => authoritative + 1);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const dirtyGuard = useDirtyCloseGuard(op.draft !== null, close);

  const open = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const bodyProps = {
    matchReference: MATCH_REFERENCE,
    dateLabel: matchW3Identity.kickoffDate ?? "",
    roundLabel: MATCH_W3_ROUND_LABEL,
    countLabel: "Planned squad",
    currentCount: op.authoritative,
    targetCount: MATCH_W3_TARGET_SQUAD_SIZE,
    actionLabel: "Add player",
    candidate,
    isDraftSelected: op.draft !== null,
    onSelectCandidate: () => op.setDraft(op.draft ? null : { candidateId: candidate.playerId }),
    status: op.status,
    outcome: op.outcome,
    onConfirm: () => op.submit(conflictOutcome),
    onResolvePending: op.resolvePending,
    onDiscardDraft: op.discardDraft,
  };

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a09-today-quick-action" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A09 Today quick action
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A09-S5 — Stale revision / already a participant</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">Today · {matchW3Identity.kickoffDate}</p>
      </div>

      <AppearanceControl />

      <p className="text-[13px] text-[var(--foreground)]">{MATCH_REFERENCE}</p>

      <button type="button" onClick={open} className="w-fit rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)]">
        Add player
      </button>

      {isDesktop && isOpen ? (
        <TodayQuickActionInspector
          {...bodyProps}
          confirmingClose={dirtyGuard.confirming}
          onRequestClose={dirtyGuard.requestClose}
          onConfirmDiscardAndClose={dirtyGuard.confirmDiscardAndClose}
          onCancelClose={dirtyGuard.cancelConfirm}
        />
      ) : null}

      <TodayQuickActionSheet
        isOpen={!isDesktop && isOpen}
        {...bodyProps}
        confirmingClose={dirtyGuard.confirming}
        onRequestClose={dirtyGuard.requestClose}
        onConfirmDiscardAndClose={dirtyGuard.confirmDiscardAndClose}
        onCancelClose={dirtyGuard.cancelConfirm}
      />
    </div>
  );
}
