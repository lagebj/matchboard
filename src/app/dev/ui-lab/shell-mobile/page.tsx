import { UiLabShell } from "../ui-lab-shells";
import { ShellContent } from "../shell-content";

/**
 * Golden: shell-mobile (390×844). Touchline Finish & Visual Convergence
 * follow-up (`10_REFERENCE_CONFORMANCE.md §4`) — the floating-nav compact
 * shell + widget-rich overview composition (distinct from the plain
 * `/dev/ui-lab/today`, which keeps exercising the original operational-
 * timeline-only Today grammar).
 */
export default function UiLabShellMobilePage() {
  return (
    <UiLabShell activeKey="today" contentWidthClass="max-w-[560px]">
      <ShellContent />
    </UiLabShell>
  );
}
