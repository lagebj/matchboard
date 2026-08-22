import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponsiveTable, ResponsiveTableCard } from "../responsive-table";

type Row = { id: string; name: string };

describe("ResponsiveTable", () => {
  const items: Row[] = [
    { id: "1", name: "Alice" },
    { id: "2", name: "Bob" },
  ];

  it("renders the table markup and the card list simultaneously (CSS decides visibility, not JS)", () => {
    const { container } = render(
      <ResponsiveTable
        items={items}
        getKey={(r) => r.id}
        renderTable={() => (
          <table>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        renderCard={(r) => <div data-testid="card">{r.name}</div>}
      />,
    );
    expect(container.querySelector("table")).toBeTruthy();
    expect(screen.getAllByTestId("card").length).toBe(2);
  });

  it("wraps the table in a container hidden below the expanded tier", () => {
    const { container } = render(
      <ResponsiveTable
        items={items}
        getKey={(r) => r.id}
        renderTable={() => <table />}
        renderCard={(r) => <div>{r.name}</div>}
      />,
    );
    const tableWrapper = container.querySelector("table")?.parentElement;
    expect(tableWrapper?.className).toContain("hidden");
    expect(tableWrapper?.className).toContain("expanded:block");
  });

  it("wraps cards in a container hidden at the expanded tier and above", () => {
    render(
      <ResponsiveTable
        items={items}
        getKey={(r) => r.id}
        renderTable={() => <table />}
        renderCard={(r) => <div data-testid="card">{r.name}</div>}
      />,
    );
    const cardWrapper = screen.getAllByTestId("card")[0].parentElement?.parentElement;
    expect(cardWrapper?.className).toContain("expanded:hidden");
  });

  it("renders the empty state instead of cards when items is empty", () => {
    render(
      <ResponsiveTable
        items={[]}
        getKey={(r: Row) => r.id}
        renderTable={() => <table />}
        renderCard={(r: Row) => <div data-testid="card">{r.name}</div>}
        emptyState={<p>No rows yet.</p>}
      />,
    );
    expect(screen.getByText("No rows yet.")).toBeTruthy();
    expect(screen.queryByTestId("card")).toBeNull();
  });
});

describe("ResponsiveTableCard", () => {
  it("renders title, fields, and actions", () => {
    render(
      <ResponsiveTableCard
        title="Ada Lovelace"
        fields={[{ label: "Team", value: "Blue" }]}
        actions={<button>Open</button>}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Team")).toBeTruthy();
    expect(screen.getByText("Blue")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
  });

  it("renders the title as a link when titleHref is provided", () => {
    render(<ResponsiveTableCard title="Ada Lovelace" titleHref="/players/1" fields={[]} />);
    const link = screen.getByRole("link", { name: "Ada Lovelace" });
    expect(link.getAttribute("href")).toBe("/players/1");
  });
});
