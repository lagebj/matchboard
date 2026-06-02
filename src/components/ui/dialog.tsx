"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Dialog — single modal primitive.
 *
 * Replaces five duplicate inline modal markups that previously lived in
 * `round-board.tsx`, `confirm-finalize-dialog.tsx`, `decision-panel.tsx`,
 * `recommendation-panel.tsx`, and `post-match-page.tsx`.
 *
 * Behavior:
 * - Closes on Escape.
 * - Click outside the panel closes the dialog (via onClose).
 * - Initial focus is moved to the close button so keyboard users land inside.
 * - Body scroll is locked while open.
 */
type DialogSize = "sm" | "md" | "lg";

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  ariaLabel?: string;
  /**
   * Optional id used for aria-labelledby on the dialog. Defaults to a stable string.
   */
  labelledById?: string;
};

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  ariaLabel,
  labelledById,
}: DialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
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
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headingId = labelledById ?? "dialog-title";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
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
        className={[
          "relative z-10 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-2xl max-h-[85vh] flex flex-col",
          sizeClasses[size],
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-3.5 shrink-0">
          <div className="min-w-0 flex flex-col gap-0.5">
            <h2
              id={headingId}
              className="text-base font-semibold text-zinc-50"
            >
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
            aria-label="Close dialog"
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
