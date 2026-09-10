"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TouchlineBottomSheet (bundle `10_RESPONSIVE_AND_TOUCH_CONTRACT.md §8`,
 * `12_COMPONENT_CONTRACTS.md §14`).
 *
 * One shared compact sheet behaviour — max 88vh, 16 px top radius,
 * control-layer material, a visible close control, keyboard-safe, independent
 * body scroll, safe-area respected. Swipe-down is not required for the sheet to
 * be fully usable; the X (or a Cancel action in `footer`) always works. Do not
 * fork route-specific modal implementations that share these semantics.
 */
type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
};

export function TouchlineBottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  ariaLabel,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      return;
    }
    closeRef.current?.focus();
    const raf = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="fixed inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? undefined}
        aria-labelledby={ariaLabel ? undefined : "tl-sheet-title"}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        className={cn(
          "relative z-10 flex max-h-[88vh] w-full flex-col rounded-t-[var(--tl-c-radius-overlay)] border-t border-[var(--border-strong)] bg-[var(--tl-c-canvas-raised)] shadow-[var(--tl-c-shadow-overlay)] transition-transform duration-[var(--tl-c-motion-panel)] ease-[var(--tl-c-motion-ease)]",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-soft)] px-5 py-3.5">
          <div className="min-w-0">
            <h2 id="tl-sheet-title" className="text-[16px] font-[620] text-[var(--foreground)]">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[var(--tl-c-radius-control)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children ? <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-soft)] px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
