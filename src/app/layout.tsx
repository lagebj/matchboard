import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopBar } from "@/components/app-top-bar";
import { AppMobileNav } from "@/components/app-mobile-nav";
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
        <div className="app-shell flex min-h-full">
          <aside className="sticky top-0 z-30 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r app-hairline bg-[rgba(10,13,19,0.96)] backdrop-blur-2xl lg:flex">
            <AppSidebar />
          </aside>
          <div className="flex min-h-screen flex-1 flex-col">
            <header className="sticky top-0 z-20 border-b app-hairline bg-[rgba(10,13,19,0.82)] backdrop-blur-2xl">
              <AppTopBar />
            </header>
            <main className="flex-1 pb-20 lg:pb-0">
              <div className="mx-auto w-full max-w-[96rem] px-6 py-8 sm:px-10">
                {children}
              </div>
            </main>
          </div>
        </div>
        <AppMobileNav />
      </body>
    </html>
  );
}