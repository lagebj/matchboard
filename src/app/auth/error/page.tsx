import { auth, signOut } from "@/auth";

export default async function AccessDeniedPage() {
  const session = await auth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Access denied
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {session?.user?.email
              ? `${session.user.email} is not authorized to access Matchboard.`
              : "You are not authorized to access Matchboard."}
          </p>
          <p className="mt-2 text-center text-sm text-gray-500">
            Contact your club administrator to be added to the coach allowlist.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {session && (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/auth/signin" });
              }}
            >
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Sign out
              </button>
            </form>
          )}
          {!session && (
            <a
              href="/auth/signin"
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Sign in with a different account
            </a>
          )}
        </div>
      </div>
    </div>
  );
}