export default function Loading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] app-copy-muted">
          Loading
        </p>
      </div>
    </main>
  );
}
