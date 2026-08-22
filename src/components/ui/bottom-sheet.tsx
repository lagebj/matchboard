"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * BottomSheet — modal primitive for phone-width destination/action pickers.
 *
 * Modeled on `Dialog`'s API and behavior (Escape-to-close, click-outside
 * closes, focus management, body-scroll lock) but slides up from the bottom,
 * full-width, rounded top corners only, and respects the bottom safe area.
 *
 * The visible close affordance (X button, or a Cancel action in `footer`)
 * always works — swipe-down-to-dismiss is not implemented here and is not
 * required for the sheet to be fully usable (PROGRAMME.md §23/§51).
 */
type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  labelledById?: string;
};

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  ariaLabel,
  labelledById,
}: BottomSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      return;
    }
    closeRef.current?.focus();
    const raf = requestAnimationFrame(() => setEntered(true));
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
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headingId = labelledById ?? "bottom-sheet-title";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : headingId}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        className={[
          "relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-xl border-t border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-2xl transition-transform duration-200 ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--border-strong)]"
          aria-hidden="true"
        />
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-3.5 shrink-0">
          <div className="min-w-0 flex flex-col gap-0.5">
            <h2 id={headingId} className="text-base font-semibold text-zinc-50">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-[var(--text-muted)]">{description}</p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children && (
          <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
            {children}
          </div>
        )}

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-soft)] px-5 py-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
