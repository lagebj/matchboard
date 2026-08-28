"use client";

import { HelpCircle, X, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { resolveHelpContextId, getHelpTarget } from "@/lib/help/help-context";

/**
 * Contextual Help drawer (ADR-0103, user-documentation-experience Phase 5).
 *
 * Opens as a right-side panel over the current application route -- the parent route never
 * changes, so any unsaved UI state on the page behind it is preserved (PROGRAMME.md §9.3).
 * Renders a same-origin compact embed of the canonical public docs (an <iframe> to /docs/**)
 * rather than a second MDX rendering pipeline -- one canonical content source (D8).
 *
 * Modeled on Dialog/BottomSheet's behavior (Escape-to-close, click-outside closes, body-scroll
 * lock) but additionally restores focus to the element that opened it, since that trigger is
 * often still meaningfully in view once Help closes (unlike a one-off confirmation dialog).
 */
export function HelpDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [entered, setEntered] = useState(false);

  const contextId = resolveHelpContextId(pathname ?? "");
  const target = getHelpTarget(contextId);

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => setEntered(true));
    closeRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        className={[
          "relative z-10 flex h-full w-full flex-col border-l border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-2xl transition-transform duration-200 ease-out sm:w-[440px]",
          entered ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
            <span className="truncate text-sm font-semibold text-zinc-50">Help — {target.label}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={target.docsPath}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
            >
              Open full documentation
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
              aria-label="Close help"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <iframe
          key={target.docsPath}
          src={target.docsPath}
          title={`Matchboard documentation — ${target.label}`}
          className="flex-1 border-0 bg-[var(--background)]"
        />
      </div>
    </div>
  );
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
      aria-label="Open help"
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
      <span className="hidden md:inline">Help</span>
    </button>
  );
}
