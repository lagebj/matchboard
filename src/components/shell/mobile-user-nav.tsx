import { auth, signOut } from "@/auth";
import { LogOut } from "lucide-react";

export async function MobileUserNav() {
  const session = await auth();
  if (!session?.user?.email) return null;

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/auth/signin" });
      }}
    >
      <button
        type="submit"
        className="flex items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-zinc-50"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign out</span>
      </button>
    </form>
  );
}