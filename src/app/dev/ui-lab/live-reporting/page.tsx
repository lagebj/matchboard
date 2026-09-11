import { UiLabShell } from "../ui-lab-shells";
import { LiveReportingContent } from "./live-reporting-content";

export default function UiLabLiveReportingPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[560px]">
      <LiveReportingContent />
    </UiLabShell>
  );
}
