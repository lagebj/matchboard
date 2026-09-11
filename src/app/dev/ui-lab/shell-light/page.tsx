import { UiLabShell } from "../ui-lab-shells";
import { ShellContent } from "../shell-content";

/**
 * Golden: shell-light-desktop (1440×900). Touchline Finish & Visual
 * Convergence follow-up (`10_REFERENCE_CONFORMANCE.md §4`) — light-theme
 * desktop shell + widget-rich overview composition. Force `?theme=light` for
 * screenshot capture; the shell itself is theme-adaptive.
 */
export default function UiLabShellLightPage() {
  return (
    <UiLabShell activeKey="today" contentWidthClass="max-w-[1180px]">
      <ShellContent />
    </UiLabShell>
  );
}
