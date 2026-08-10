"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0d13] font-sans text-foreground">
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--warning)]">
            Something went wrong
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50">
            Matchboard encountered an error
          </h1>
          <p className="max-w-md text-sm text-zinc-400">
            An unexpected error occurred. Please try again.
          </p>
          <button
            className="rounded-full border border-[rgba(205,219,210,0.28)] px-5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}