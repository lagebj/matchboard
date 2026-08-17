import { auth, signOut } from "@/auth";

export default async function AccessDeniedPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50">
            Access denied
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            {session?.user?.email
              ? "You are not a member of any organisation on Matchboard."
              : "You are not authorized to access Matchboard."}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Contact your organisation owner or admin to request an invitation.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {session && (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <button
                type="submit"
                className="w-full flex justify-center rounded-xl border border-[rgba(205,219,210,0.28)] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-50"
              >
                Sign out
              </button>
            </form>
          )}
          <a
            href="/signin"
            className="w-full flex justify-center rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Sign in with a different account
          </a>
        </div>
      </div>
    </div>
  );
}