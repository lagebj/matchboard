import { requireActorContext } from "@/lib/auth/actor-context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function PATCH(request: Request) {
  const ctx = await requireActorContext();

  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "League season ID is required." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json({ error: "League season name is required." }, { status: 400 });
    }

    if (name.trim().length > 100) {
      return Response.json({ error: "League season name must be 100 characters or fewer." }, { status: 400 });
    }

    const existing = await db.leagueSeason.findUnique({
      where: { id },
    });
    if (!existing) {
      return Response.json({ error: "League season not found." }, { status: 404 });
    }

    if (existing.organisationId !== ctx.organisationId) {
      return Response.json({ error: "League season not found or access denied." }, { status: 404 });
    }

    await db.leagueSeason.update({
      where: { id },
      data: { name: name.trim() },
    });

    revalidatePath("/fixtures");
    revalidatePath("/players");
    revalidatePath("/teams");
    revalidatePath("/assistant");
    revalidatePath("/season");

    return Response.json({ success: true, name: name.trim() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to update league season name." },
      { status: 500 },
    );
  }
}