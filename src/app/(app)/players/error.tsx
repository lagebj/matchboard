"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134): this error boundary
    // renders inside (app)/layout.tsx's <main>, which is not itself .touchline-scoped (only the
    // shell nav/top-bar are), so it needs its own explicit class.
    <main className="touchline flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--warning)]">
        Something went wrong
      </p>
      <p className="max-w-md text-sm app-copy-soft">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        className="rounded-full border app-hairline px-5 py-2 text-sm font-medium app-copy-soft hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}