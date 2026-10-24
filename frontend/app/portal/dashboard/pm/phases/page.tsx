"use client";

import { useState } from "react";
import type { PmProject } from "@/lib/api";
import { ProjectMaster } from "../_components/ProjectMaster";
import { PhasesDetail } from "./PhasesDetail";

export default function PhasesPage() {
  const [openProject, setOpenProject] = useState<PmProject | null>(null);

  return (
    <>
      <ProjectMaster
        kicker="Project Phases"
        title="Phases"
        subtitle="Choose a project to manage its phases and schedule"
        actionLabel="View Phases"
        onOpen={setOpenProject}
      />

      {openProject ? (
        <PhasesDetail project={openProject} onClose={() => setOpenProject(null)} />
      ) : null}
    </>
  );
}
