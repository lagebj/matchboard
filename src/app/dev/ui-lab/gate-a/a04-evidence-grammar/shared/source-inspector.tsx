"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { TouchlineBottomSheet } from "@/components/touchline";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { SourceRecordList } from "./source-record-list";
import type { SourceRecord } from "./coverage";

/**
 * `SourceInspector` — A04's generic context-local source drilldown, shared by all six scenarios.
 * Same responsive grammar as W1's A01 `LineupContextualInspector`: `useMediaQuery` picks exactly
 * one of an inline desktop panel (`aria-modal="false"`) or a mobile `TouchlineBottomSheet`, never
 * both, sharing one `isOpen` state and one `SourceRecordList`. Read-only — no save/update/apply/
 * mutation/annotation/upload/AI call exists here (`03_PRESENTATION_AND_INTERACTION_CONTRACT.md`).
 * The caller owns focus-restoration on close (same pattern as A01's page-level trigger ref).
 */
type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  sources: readonly SourceRecord[];
  className?: string;
};

export function SourceInspector({ isOpen, onClose, title, description, sources, className }: Props) {
  const isDesktop = useMediaQuery("(min-width: 600px)");
  const showInspector = isOpen && isDesktop;
  const showSheet = isOpen && !isDesktop;

  return (
    <>
      {showInspector ? (
        <InlineSourceInspector title={title} description={description} sources={sources} onClose={onClose} className={className} />
      ) : null}
      <TouchlineBottomSheet
        isOpen={showSheet}
        onClose={onClose}
        title={title}
        description={description}
        tone="utility"
        ariaLabel="Source inspector"
      >
        <p className="text-[11px] text-[var(--text-muted)]">
          Read-only — inspects the recorded sources behind this finding. No production mutation.
        </p>
        <SourceRecordList sources={sources} />
      </TouchlineBottomSheet>
    </>
  );
}

function InlineSourceInspector({
  title,
  description,
  sources,
  onClose,
  className,
}: {
  title: string;
  description?: string;
  sources: readonly SourceRecord[];
  onClose: () => void;
  className?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label="Source inspector"
      role="dialog"
      aria-modal="false"
      className={cn(
        "flex w-full flex-col gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4 shadow-[var(--tl-widget-shadow)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Sources</p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--foreground)]">{title}</p>
          {description ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p> : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">
        Read-only — inspects the recorded sources behind this finding. No production mutation.
      </p>
      <SourceRecordList sources={sources} />
    </aside>
  );
}
