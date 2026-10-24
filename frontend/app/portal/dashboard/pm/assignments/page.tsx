"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { PmProjectGate } from "../_components/PmProjectGate";
import { usePmProject } from "../_components/projectSelection";
import { AssignmentsPanel } from "./AssignmentsDetail";

export default function AssignmentsPage() {
  const { selected } = usePmProject();

  return (
    <SaPage
      kicker="Operations"
      title="Assignments"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project_name}`
          : "Select a project to review its worker assignments."
      }
    >
      <PmProjectGate>{(projectId) => <AssignmentsPanel projectId={projectId} />}</PmProjectGate>
    </SaPage>
  );
}
