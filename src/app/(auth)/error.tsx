"use client";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--warning)]">
            Something went wrong
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-zinc-50">
            Authentication error
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            {error.message || "An unexpected error occurred during sign in."}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            className="w-full flex justify-center rounded-xl border border-[rgba(205,219,210,0.28)] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <a
            href="/signin"
            className="w-full flex justify-center rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Return to sign in
          </a>
        </div>
      </div>
    </div>
  );
}