import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import A03PermissionDeniedPage from "../page";

function renderPage() {
  return render(
    <ThemeProvider>
      <A03PermissionDeniedPage />
    </ThemeProvider>,
  );
}

describe("A03-S3 permission-denied page", () => {
  it("shows the denial reason", () => {
    renderPage();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(screen.getByText(/do not have access to this team's planning group/i)).toBeInTheDocument();
  });

  it("never renders Tobias, Vetle, or RCM — a denied actor must not see records they would not see in production", () => {
    const { container } = renderPage();
    expect(container.textContent).not.toMatch(/Tobias/);
    expect(container.textContent).not.toMatch(/Vetle/);
    expect(container.textContent).not.toMatch(/RCM/);
  });

  it("has no action control of any kind", () => {
    renderPage();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
