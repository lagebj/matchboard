import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50">
        Page not found
      </h1>
      <p className="max-w-md text-sm text-zinc-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="rounded-full border border-[rgba(205,219,210,0.28)] px-5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
      >
        Return to Matchboard
      </Link>
    </main>
  );
}