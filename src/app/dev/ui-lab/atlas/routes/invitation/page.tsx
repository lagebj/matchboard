import { TouchlineButton } from "@/components/touchline";
import { invitationFixture } from "../../fixtures";

/**
 * Invitation — `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md §H`. Auth-adjacent page — no
 * app shell/sidebar (matches the real `/invite/[token]` route living inside `(app)` but outside
 * protected navigation). Current invitation facts only — no marketing feature list.
 */
export default function AtlasInvitationPage() {
  const vm = invitationFixture;
  return (
    <div className="touchline flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-[420px] rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-6 text-center shadow-[var(--tl-widget-shadow)]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">Invitation</p>
        <h1 className="mt-2 text-[22px] font-[650] text-[var(--foreground)]">{vm.organisationName}</h1>
        <p className="mt-2 text-[14px] text-[var(--text-soft)]">
          You have been invited to join {vm.organisationName} as {vm.intendedRole.toLowerCase()}.
        </p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{vm.invitedEmail}</p>
        <div className="mt-5 flex flex-col gap-2">
          <TouchlineButton variant="primary" className="w-full">Accept invitation</TouchlineButton>
          <button type="button" className="text-[13px] text-[var(--text-muted)] underline">Use another account</button>
        </div>
      </div>
    </div>
  );
}
