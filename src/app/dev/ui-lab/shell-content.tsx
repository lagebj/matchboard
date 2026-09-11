import {
  TouchlinePageHeader,
  TouchlineButton,
  OperationalMatchCard,
  TouchlineWidget,
  WidgetHeader,
  MetricStrip,
  QuickActionGrid,
  ScorebookMatchRow,
  TouchlineTimeline,
  TimelineItem,
  EvidenceStory,
  PhaseDistribution,
} from "@/components/touchline";
import {
  shellNextMatch,
  shellSquadStatus,
  shellNotAvailable,
  shellRecentMatches,
  shellQuickActions,
  shellThisWeek,
} from "./fixtures";

/**
 * Shared widget-rich Today/shell composition used by the `shell-light`
 * (desktop) and `shell-mobile` (compact) UI Lab routes
 * (`08_PLAYER_EVENT_INSIGHTS_AND_OVERVIEWS.md §3`). Distinct from the plain
 * `/dev/ui-lab/today` route, which keeps exercising the original operational-
 * timeline-only Today grammar (`today-mobile-existing.png` is retained
 * authority for that simpler surface).
 *
 * Compact narrative order (§3, normative): identity → next-action feature →
 * attention → temporal flow → recent football → one insight preview. A
 * "Quick actions" widget is inserted right after the feature widget — an
 * addition beyond §3's minimum list, justified by `04_WIDGET_AND_CONTENT_
 * GRAMMAR.md §6/§7`'s explicit `QuickActionGrid` primitive and the golden
 * reference's own inclusion of it; every action is a real, already-reachable
 * destination (never invented to fill the grid).
 */
export function ShellContent() {
  return (
    <>
      <TouchlinePageHeader title="Today" context="Thursday · 10 September 2026" />

      <div className="mt-5 grid grid-cols-1 gap-5 expanded:grid-cols-12">
        <div className="expanded:col-span-8">
          <OperationalMatchCard
            presentation={shellNextMatch}
            variant="feature"
            kicker="NEXT MATCH"
            contextLabel="G2015 · League"
            contextLine="Slemmestad · Pitch 1"
            action={<TouchlineButton variant="primary">Match details →</TouchlineButton>}
          />
        </div>

        <div className="expanded:col-span-4">
          <TouchlineWidget>
            <WidgetHeader eyebrow="Squad status" title="18 available" action={<a href="#" className="text-[13px] font-medium text-[var(--accent)] no-underline">View all</a>} />
            <div className="mt-3">
              <MetricStrip items={shellSquadStatus} />
            </div>
            <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--border-soft)] pt-3">
              {shellNotAvailable.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-[var(--text-soft)]">{p.name}</span>
                  <span className={p.tone === "danger" ? "text-[var(--danger)]" : "text-[var(--warning)]"}>
                    {p.reason}
                  </span>
                </li>
              ))}
            </ul>
          </TouchlineWidget>
        </div>

        <div className="expanded:col-span-12">
          <TouchlineWidget tone="quiet" padding="compact">
            <QuickActionGrid actions={shellQuickActions} />
          </TouchlineWidget>
        </div>

        <div className="expanded:col-span-8">
          <TouchlineWidget>
            <WidgetHeader title="Latest matches" action={<a href="#" className="text-[13px] font-medium text-[var(--accent)] no-underline">View all</a>} />
            <div className="mt-2 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
              {shellRecentMatches.map((m) => (
                <ScorebookMatchRow key={m.id} presentation={m} />
              ))}
            </div>
          </TouchlineWidget>
        </div>

        <div className="expanded:col-span-6">
          <TouchlineWidget>
            <WidgetHeader title="This week" action={<a href="#" className="text-[13px] font-medium text-[var(--accent)] no-underline">View all</a>} />
            <div className="mt-2">
              <TouchlineTimeline aria-label="This week">
                {shellThisWeek.map((item, i) => (
                  <TimelineItem
                    key={item.label}
                    timeLabel={item.meta.split(" · ")[0]}
                    state={i === 0 ? "current" : "later"}
                    highlighted={i === 0}
                    isLast={i === shellThisWeek.length - 1}
                  >
                    <p className="text-[15px] font-[600] text-[var(--foreground)]">{item.label}</p>
                    {item.tag ? (
                      <p className="text-[13px] font-medium text-[var(--accent)]">{item.tag}</p>
                    ) : (
                      <p className="text-[13px] text-[var(--text-muted)]">{item.meta.split(" · ").slice(1).join(" · ")}</p>
                    )}
                  </TimelineItem>
                ))}
              </TouchlineTimeline>
            </div>
          </TouchlineWidget>
        </div>

        <div className="expanded:col-span-6">
          <EvidenceStory
            question="How often do goals against arrive in the opening phase?"
            label="Opening phases"
            title="Opening phases remain vulnerable"
            value="43%"
            valueCaption="of recorded goals against arrived in the opening phase"
            visual={
              <PhaseDistribution
                question="How often do goals against arrive in the opening phase?"
                segments={[
                  { label: "0–10", value: 6, highlighted: true },
                  { label: "10–20", value: 3 },
                  { label: "20–30", value: 2 },
                  { label: "30–40", value: 1 },
                  { label: "40+", value: 2 },
                ]}
              />
            }
            sample="14 goals · 8 matches"
            confidence="Established"
            detailHref="/dev/ui-lab/insights"
            detailLabel="Open insights"
          />
        </div>
      </div>
    </>
  );
}
