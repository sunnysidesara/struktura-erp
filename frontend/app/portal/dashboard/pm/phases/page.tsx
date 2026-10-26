"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { PmProjectGate } from "../_components/PmProjectGate";
import { usePmProject } from "../_components/projectSelection";
import { PhasesPanel } from "./PhasesDetail";

export default function PhasesPage() {
  const { selected } = usePmProject();

  return (
    <SaPage
      kicker="Project Phases"
      title="Phases"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project_name}`
          : "Select a project to manage its phases and schedule."
      }
    >
      <PmProjectGate>
        {() => (selected ? <PhasesPanel project={selected} /> : null)}
      </PmProjectGate>
    </SaPage>
  );
}
