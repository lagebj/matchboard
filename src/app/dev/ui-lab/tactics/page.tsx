import { UiLabShell } from "../ui-lab-shells";
import { TacticsContent } from "./tactics-content";

export default function UiLabTacticsPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-none">
      <TacticsContent />
    </UiLabShell>
  );
}
