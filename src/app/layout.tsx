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
          <header className="sticky top-0 z-20 border-b app-hairline bg-[rgba(13,16,22,0.82)] backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 sm:px-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--accent-strong)]">
                    Matchboard
                  </p>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-zinc-100">
                      Local-first match selection and rotation history.
                    </p>
                    <p className="text-sm app-copy-muted">
                      One match at a time, with the current decision carried forward into history.
                    </p>
                  </div>
                </div>
                <div className="app-panel rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-[0.22em] app-copy-soft">
                  Operational Workspace
                </div>
              </div>
              <div className="border-t app-hairline pt-4">
                <AppNavigation />
              </div>
            </div>
          </header>

          <div className="flex-1">
            <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10">
              <div className="min-h-[calc(100vh-11rem)]">{children}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
