export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Touchline island, intentionally dark-pinned (not a migration deferral): AGENTS.md's
    // "Auth layout rules" require auth pages to always use the Matchboard dark theme, regardless
    // of the viewer's light/dark preference — a deliberate, permanent product/security decision,
    // not an unmigrated surface.
    <div
      data-theme="dark"
      className="touchline flex min-h-screen items-center justify-center bg-[var(--background)]"
    >
      {children}
    </div>
  );
}