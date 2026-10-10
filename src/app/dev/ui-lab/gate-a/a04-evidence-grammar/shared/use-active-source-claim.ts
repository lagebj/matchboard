"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Enforces exactly one active source-inspector claim per page (independent review round 2, PR
 * #778, finding R4): a page with more than one scoped "Inspect..." trigger must never have more
 * than one open dialog at a time. `open(key)` both opens the inspector AND switches it to a
 * different claim while already open — a desktop user clicking a second "Inspect..." control (the
 * inline inspector is `aria-modal="false"`, so nothing blocks that click) swaps the inspector's
 * content in place rather than stacking a second dialog.
 *
 * `open`/`close` are `useCallback`-stabilized so `SourceInspector`'s own effects (focus trap,
 * Escape listener, body-scroll lock) don't needlessly re-run on every unrelated re-render — only
 * when the active claim genuinely changes.
 */
export function useActiveSourceClaim<K extends string>() {
  const [activeClaim, setActiveClaim] = useState<K | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((key: K) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveClaim(key);
  }, []);

  const close = useCallback(() => {
    setActiveClaim(null);
    triggerRef.current?.focus();
  }, []);

  return { activeClaim, open, close };
}
