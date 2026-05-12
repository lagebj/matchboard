import { Suspense } from "react";
import { FixturesPage } from "@/components/fixtures/fixtures-page";

export default function FixturesRoute() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-500">Loading fixtures...</div>}>
      <FixturesPage />
    </Suspense>
  );
}