import { auth, signOut } from "@/auth";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";

export async function UserNav() {
  const session = await auth();

  if (!session?.user) return null;

  const email = session.user.email ?? "";
  const name = session.user.name ?? email;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/organisations"
        className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/50 hover:text-zinc-100 transition-colors"
        title="Organisations"
        aria-label="Organisations"
      >
        <Settings className="h-3.5 w-3.5" />
      </Link>
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)]/60 text-[10px] font-semibold text-[var(--accent-strong)]"
        title={name}
        aria-label={name}
      >
        {initials}
      </div>
      <span className="hidden text-xs text-[var(--text-muted)] sm:inline">{name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button
          type="submit"
          className="ml-0.5 rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]/50 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/55"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
