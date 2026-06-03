import { FormationsBuilderClient } from "@/components/formations/formations-builder";

type NewFormationPageProps = {
  searchParams: Promise<{
    gameFormat?: string;
    returnTo?: string;
  }>;
};

export default async function NewFormationPage({ searchParams }: NewFormationPageProps) {
  const { gameFormat, returnTo } = await searchParams;

  return (
    <FormationsBuilderClient
      gameFormat={gameFormat}
      returnTo={returnTo || "/formations"}
    />
  );
}