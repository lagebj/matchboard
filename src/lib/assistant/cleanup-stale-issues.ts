import { db } from "@/lib/db";

export async function cleanupStaleAssistantIssues(): Promise<{
  deletedCount: number;
}> {
  const result = await db.assistantIssue.deleteMany({
    where: { status: "OPEN" },
  });

  return { deletedCount: result.count };
}