import { UiLabShell } from "../ui-lab-shells";
import { PlayerDetailContent } from "./player-detail-content";

export default function UiLabPlayerDetailPage() {
  return (
    <UiLabShell activeKey="players" contentWidthClass="max-w-[720px]">
      <PlayerDetailContent />
    </UiLabShell>
  );
}
