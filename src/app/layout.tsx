import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Matchboard",
  description: "Local-first squad selection and rotation planning for youth football.",
};

const workflowSteps = [
  "Check players and teams",
  "Plan this week's matches",
  "Pick and adjust squads",
  "Lock or reset selections",
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <div className="app-shell flex min-h-full flex-col">
          <header className="sticky top-0 z-20 border-b app-hairline bg-[rgba(10,13,19,0.82)] backdrop-blur-2xl">
            <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-6 py-5 sm:px-10">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:items-end">
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-strong)]">
                    Matchboard
                  </p>
                  <p className="max-w-3xl text-2xl font-semibold tracking-[-0.03em] text-zinc-50 sm:text-3xl">
                    What needs doing this week?
                  </p>
                  <p className="max-w-3xl text-sm leading-7 app-copy-soft">
                    Start from the next action, keep the weekly board readable, and lock decisions
                    when they are ready.
                  </p>
                </div>

                <div className="app-panel rounded-[1.5rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                    Quick Loop
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {workflowSteps.map((step, index) => (
                      <div
                        key={step}
                        className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] app-copy-muted">
                          Step {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-medium text-zinc-100">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t app-hairline pt-4">
                <AppNavigation />
              </div>
            </div>
          </header>

          <div className="flex-1">
            <div className="mx-auto flex w-full max-w-[96rem] flex-col px-6 py-8 sm:px-10">
              <div className="min-h-[calc(100vh-14rem)]">{children}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
