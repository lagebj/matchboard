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
      <body className="min-h-full bg-zinc-50 font-sans text-zinc-950">
        <div className="flex min-h-full flex-col">
          <header className="border-b border-zinc-200 bg-white">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 sm:px-10">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
                  Matchboard
                </p>
                <p className="text-sm text-zinc-600">
                  Local match selection, rotation history, and rules in one place.
                </p>
              </div>
              <AppNavigation />
            </div>
          </header>

          <div className="flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
