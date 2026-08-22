"use client";

import { X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Toast — scoped to the "Player moved to Blue [Undo]" pattern (PROGRAMME.md
 * §35: prefer Undo over confirmation for reversible actions). Not a generic
 * success/error toast library.
 */
type ToastOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay in ms. Default 5000. */
  duration?: number;
};

type ToastRecord = ToastOptions & { id: number };

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;
let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    const id = nextToastId++;
    setToasts((current) => [...current, { id, ...options }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: () => void;
}) {
  const duration = toast.duration ?? DEFAULT_DURATION;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(onDismiss, duration);
  }, [clearTimer, duration, onDismiss]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  return (
    <div
      role="status"
      onMouseEnter={clearTimer}
      onMouseLeave={startTimer}
      onFocus={clearTimer}
      onBlur={startTimer}
      className="flex items-center gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 py-3 shadow-2xl"
    >
      <p className="flex-1 text-sm text-zinc-50">{toast.message}</p>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
          className="shrink-0 rounded text-sm font-semibold text-[var(--accent-strong)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-zinc-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
