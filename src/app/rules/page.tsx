import { RulesForm } from "@/components/rules/rules-form";
import { getRules } from "@/lib/rules/get-rules";

type RulesPageProps = {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export default async function RulesPage({ searchParams }: RulesPageProps) {
  const rules = await getRules();
  const { error, saved } = await searchParams;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Matchboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Rules</h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-600">
            Edit the single working RuleConfig row that drives core-match drop,
            floating, spacing, and preference behavior.
          </p>
        </header>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <RulesForm rules={rules} saved={saved === "1"} />
      </div>
    </main>
  );
}
