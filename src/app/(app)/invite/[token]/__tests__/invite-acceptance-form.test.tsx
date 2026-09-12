import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteAcceptanceForm } from "../invite-acceptance-form";

const { acceptInvitationActionMock, declineInvitationActionMock, useAnotherAccountActionMock } = vi.hoisted(() => ({
  acceptInvitationActionMock: vi.fn(async () => ({ success: true as const })),
  declineInvitationActionMock: vi.fn(async () => ({ success: true as const })),
  useAnotherAccountActionMock: vi.fn(async () => {
    // The real action never resolves normally on success -- it redirects. Simulate that by
    // returning a pending promise (never settling) unless a test overrides the mock.
    await new Promise(() => {});
  }),
}));

vi.mock("@/app/(app)/organisations/actions", () => ({
  acceptInvitationAction: acceptInvitationActionMock,
  declineInvitationAction: declineInvitationActionMock,
}));

vi.mock("../invite-account-actions", () => ({
  useAnotherAccountAction: useAnotherAccountActionMock,
}));

/**
 * Touchline Design Atlas (ADR-0136 Phase 7, `10_ROUTE_COMPOSITION_CONFIG_MORE_REVIEWS_AUTH.md
 * §H`): "Use current invitation facts only: organisation/group identity; invitation meaning;
 * accept; use another account." "Use another account" was entirely absent before this fix --
 * these tests lock in its presence and behaviour, alongside the pre-existing accept/decline
 * actions this composition fix must not disturb.
 */
describe("InviteAcceptanceForm (Touchline Design Atlas Phase 7, §H)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders accept, decline, and use-another-account actions", () => {
    render(
      <InviteAcceptanceForm token="tok-1" organisationName="Fjordvik IL" organisationSlug="fjordvik-il" />,
    );

    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use another account" })).toBeInTheDocument();
  });

  it("calls useAnotherAccountAction with the invite token when clicked", async () => {
    const user = userEvent.setup();
    render(
      <InviteAcceptanceForm token="tok-1" organisationName="Fjordvik IL" organisationSlug="fjordvik-il" />,
    );

    await user.click(screen.getByRole("button", { name: "Use another account" }));

    expect(useAnotherAccountActionMock).toHaveBeenCalledWith("tok-1");
  });

  it("disables the other actions while switching accounts", async () => {
    const user = userEvent.setup();
    render(
      <InviteAcceptanceForm token="tok-1" organisationName="Fjordvik IL" organisationSlug="fjordvik-il" />,
    );

    await user.click(screen.getByRole("button", { name: "Use another account" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Switching account..." })).toBeDisabled();
    });
  });

  it("shows a neutral error and re-enables actions if switching accounts fails", async () => {
    useAnotherAccountActionMock.mockRejectedValueOnce(new Error("network error"));
    const user = userEvent.setup();
    render(
      <InviteAcceptanceForm token="tok-1" organisationName="Fjordvik IL" organisationSlug="fjordvik-il" />,
    );

    await user.click(screen.getByRole("button", { name: "Use another account" }));

    expect(await screen.findByText("Could not switch accounts. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use another account" })).not.toBeDisabled();
  });

  it("still accepts the invitation as before", async () => {
    const user = userEvent.setup();
    render(
      <InviteAcceptanceForm token="tok-1" organisationName="Fjordvik IL" organisationSlug="fjordvik-il" />,
    );

    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    expect(acceptInvitationActionMock).toHaveBeenCalledWith("tok-1");
    expect(await screen.findByText("Invitation accepted!")).toBeInTheDocument();
  });

  it("still declines the invitation as before", async () => {
    const user = userEvent.setup();
    render(
      <InviteAcceptanceForm token="tok-1" organisationName="Fjordvik IL" organisationSlug="fjordvik-il" />,
    );

    await user.click(screen.getByRole("button", { name: "Decline" }));

    expect(declineInvitationActionMock).toHaveBeenCalledWith("tok-1");
    expect(await screen.findByText("Invitation declined")).toBeInTheDocument();
  });
});
