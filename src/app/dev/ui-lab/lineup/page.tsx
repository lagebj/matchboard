import { UiLabShell } from "../ui-lab-shells";
import { LineupContent } from "./lineup-content";

export default function UiLabLineupPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-none large:max-w-[1180px]">
      <LineupContent />
    </UiLabShell>
  );
}
