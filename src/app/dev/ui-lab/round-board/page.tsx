import {
  TouchlinePageHeader,
  TouchlineButton,
  WorkbenchToolbar,
  RosterColumn,
  RosterRow,
  TouchlineInspector,
  InspectorFact,
} from "@/components/touchline";
import { UiLabShell } from "../ui-lab-shells";
import { roundBoardColumns } from "../fixtures";

/**
 * Golden: round-board-desktop (1440×900).
 * Calm dense workbench — compact toolbar, match lanes without nested card
 * chrome, a clear (non-luminous) selected row, a contextual inspector only when
 * the selection has inspectable content.
 */
export default function UiLabRoundBoardPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-none">
      <TouchlinePageHeader title="Round Board" context="W37 · Autumn 2026 · 3 matches" />

      <div className="mt-5">
        <WorkbenchToolbar
          context={
            <span className="font-medium text-[var(--warning)]">Plan integrity: 2 decisions</span>
          }
          actions={
            <>
              <TouchlineButton variant="ghost">Populate all</TouchlineButton>
              <TouchlineButton variant="primary">Save changes</TouchlineButton>
            </>
          }
        />
      </div>

      <div className="mt-6 flex gap-8">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-6 expanded:grid-cols-3">
          {roundBoardColumns.map((col, colIndex) => (
            <RosterColumn key={col.title} title={col.title} meta={col.meta}>
              {col.players.map((p, i) => (
                <RosterRow
                  key={p.name}
                  name={p.name}
                  code={p.code}
                  dot={p.code === "GK" ? "muted" : "on"}
                  selected={colIndex === 0 && i === 0}
                />
              ))}
            </RosterColumn>
          ))}
        </div>

        <div className="hidden large:block">
          <TouchlineInspector title="Noah" headline="Natural LW">
            <InspectorFact label="Opportunity">1 / 1 this week</InspectorFact>
            <InspectorFact label="Evidence" tone="evidence">
              Wide role exposure
              <span className="ml-2 text-[12px] font-normal">Established</span>
            </InspectorFact>
          </TouchlineInspector>
        </div>
      </div>
    </UiLabShell>
  );
}
