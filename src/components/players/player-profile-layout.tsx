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
    <div className={cn("mx-auto grid max-w-[1200px] gap-3 large:grid-cols-[300px_minmax(380px,440px)_360px] expanded:grid-cols-[260px_1fr]", className)}>
      <div className="flex flex-col gap-2">{left}</div>
      <div className="flex flex-col gap-2">{center}</div>
      <div className="flex flex-col gap-2 expanded:col-span-2 large:col-span-1">{right}</div>
      {bottom && <div className="large:col-span-3 expanded:col-span-2">{bottom}</div>}
    </div>
  );
}