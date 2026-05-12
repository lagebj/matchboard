import { auth, signOut } from "@/auth";
import { LogOut } from "lucide-react";

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
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white" title={name}>
        {initials}
      </div>
      <span className="hidden text-xs text-gray-400 sm:inline">{name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button
          type="submit"
          className="ml-0.5 rounded p-1 text-gray-400 hover:text-white"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}