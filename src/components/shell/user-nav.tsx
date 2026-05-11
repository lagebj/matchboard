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
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white" title={email}>
        {initials}
      </div>
      <span className="hidden text-sm text-gray-300 sm:inline">{name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button
          type="submit"
          className="ml-1 rounded p-1 text-gray-400 hover:text-white"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}