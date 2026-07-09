"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type PlayerProfileLayoutProps = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom?: ReactNode;
  className?: string;
};

export function PlayerProfileLayout({ left, center, right, bottom, className }: PlayerProfileLayoutProps) {
  return (
    <div className={cn("mx-auto grid max-w-[1200px] gap-3 lg:grid-cols-[300px_minmax(380px,440px)_360px] md:grid-cols-[260px_1fr]", className)}>
      <div className="flex flex-col gap-2">{left}</div>
      <div className="flex flex-col gap-2">{center}</div>
      <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-1">{right}</div>
      {bottom && <div className="lg:col-span-3 md:col-span-2">{bottom}</div>}
    </div>
  );
}