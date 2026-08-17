import { signIn } from "@/auth";
import { MatchboardLogo } from "@/components/shell/matchboard-logo";
import { BrandIllustrationBackground } from "@/components/ui/brand-illustration";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4">
      <BrandIllustrationBackground name="subtleReportSketch" className="bg-cover opacity-[0.35] dark:opacity-[0.25]" />
      <div className="relative w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-2">
            <MatchboardLogo className="h-9 w-9 text-[var(--accent-strong)]" ariaHidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-50">
            Sign in to Matchboard
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Private squad planning for coaches.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-[rgba(205,219,210,0.28)] bg-[linear-gradient(180deg,rgba(146,171,151,0.18),rgba(88,110,100,0.12))] px-4 py-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.28),rgba(88,110,100,0.22))] hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.3v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.08z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12c0 1.78.43 3.46 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </form>
        <p className="text-center text-xs text-zinc-500">
          Access requires an organisation invitation.
        </p>
        </div>
    </div>
  );
}