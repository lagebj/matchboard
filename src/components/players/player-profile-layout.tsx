"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type PlayerProfileLayoutProps = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
};

export function PlayerProfileLayout({ left, center, right, className }: PlayerProfileLayoutProps) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-[260px_1fr_300px] md:grid-cols-[260px_1fr]", className)}>
      <div className="flex flex-col gap-3">{left}</div>
      <div className="flex flex-col gap-3">{center}</div>
      <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-1">{right}</div>
    </div>
  );
}