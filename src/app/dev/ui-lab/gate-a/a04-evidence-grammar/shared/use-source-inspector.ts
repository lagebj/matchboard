"use client";

import { useRef, useState } from "react";

/**
 * Shared open/close/focus-restoration state for `SourceInspector` (same pattern as A01's
 * `lineupTriggerRef`): captures whatever was focused right before opening and returns focus to it
 * on close, regardless of which responsive presentation (inline inspector vs bottom sheet)
 * actually rendered.
 */
export function useSourceInspector() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = () => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return { isOpen, open, close };
}
