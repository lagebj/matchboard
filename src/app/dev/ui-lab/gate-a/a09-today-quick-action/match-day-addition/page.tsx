"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AppearanceControl } from "@/components/touchline";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useFixtureOperation, useDirtyCloseGuard } from "../../shared/fixture-operation";
import { TodayQuickActionInspector, TodayQuickActionSheet, type TodayQuickActionSuccess } from "../shared/today-quick-action-sheet";
import {
  matchW3Identity,
  MATCH_W3_TEAM_NAME,
  MATCH_W3_OPPONENT_NAME,
  MATCH_W3_ROUND_LABEL,
  MATCH_W3_CURRENT_SQUAD_SIZE,
  MATCH_W3_TARGET_SQUAD_SIZE,
  MATCH_W3_OPERATIONAL_ROSTER_BASE_COUNT,
} from "../../shared/match-w3-fixture";
import { candidate, successOutcome } from "./view-model";

const MATCH_REFERENCE = `${MATCH_W3_TEAM_NAME} vs ${MATCH_W3_OPPONENT_NAME} — ${MATCH_W3_ROUND_LABEL}`;

/**
 * `/dev/ui-lab/gate-a/a09-today-quick-action/match-day-addition` — A09-S6. The SEPARATE
 * operational `MATCH_DAY_ADDITION` path: its own eligibility fact, its own counter
 * ("Operational roster"), own provenance. The planned-selection line below the editor is a
 * STATIC, always-visible fact, structurally distinct from `useFixtureOperation`'s own
 * `authoritative` counter — proving one action can never accidentally touch the other concept.
 */
export default function MatchDayAdditionPage() {
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const op = useFixtureOperation<number, { candidateId: string }, TodayQuickActionSuccess>(MATCH_W3_OPERATIONAL_ROSTER_BASE_COUNT, (authoritative) => authoritative + 1);

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const dirtyGuard = useDirtyCloseGuard(op.draft !== null && op.status !== "SUCCESS", close);

  const open = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const bodyProps = {
    matchReference: MATCH_REFERENCE,
    dateLabel: matchW3Identity.kickoffDate ?? "",
    roundLabel: MATCH_W3_ROUND_LABEL,
    countLabel: "Operational roster",
    currentCount: op.authoritative,
    targetCount: null,
    actionLabel: "Add match-day helper",
    candidate,
    isDraftSelected: op.draft !== null,
    onSelectCandidate: () => op.setDraft(op.draft ? null : { candidateId: candidate.playerId }),
    status: op.status,
    outcome: op.outcome,
    onConfirm: () => op.submit(successOutcome),
    onResolvePending: op.resolvePending,
    onDiscardDraft: op.discardDraft,
  };

  return (
    <div className="touchline mx-auto flex max-w-[480px] flex-col gap-6 px-4 py-8" data-ui-lab-ready="true">
      <div>
        <Link href="/dev/ui-lab/gate-a/a09-today-quick-action" className="text-[12px] text-[var(--text-muted)] hover:underline">
          &larr; A09 Today quick action
        </Link>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">A09-S6 — Match-day addition</h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">Today · {matchW3Identity.kickoffDate}</p>
      </div>

      <AppearanceControl />

      <p className="text-[13px] text-[var(--foreground)]">{MATCH_REFERENCE}</p>

      <p data-testid="a09-s6-planned-squad-line" className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3 text-[12px] text-[var(--foreground)]">
        Planned squad: {MATCH_W3_CURRENT_SQUAD_SIZE}/{MATCH_W3_TARGET_SQUAD_SIZE} (unchanged by this action)
      </p>

      <button type="button" onClick={open} className="w-fit rounded-lg bg-[var(--accent)] px-3 py-2 text-[13px] font-[700] text-[var(--tl-accent-on-fill)]">
        Add match-day helper
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
