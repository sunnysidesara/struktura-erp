"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { PmProjectGate } from "../_components/PmProjectGate";
import { usePmProject } from "../_components/projectSelection";
import { UsagePanel } from "../_components/UsageDetail";

export default function EquipmentPage() {
  const { selected } = usePmProject();

  return (
    <SaPage
      kicker="Resources"
      title="Equipment"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project_name}`
          : "Select a project to review and log its equipment usage."
      }
    >
      <PmProjectGate>
        {(projectId) => <UsagePanel projectId={projectId} kind="equipment" />}
      </PmProjectGate>
    </SaPage>
  );
}
