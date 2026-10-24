"use client";

import { useState } from "react";
import type { PmProject } from "@/lib/api";
import { ProjectMaster } from "../_components/ProjectMaster";
import { WorkforceDetail } from "./WorkforceDetail";

export default function WorkforcePage() {
  const [openProject, setOpenProject] = useState<PmProject | null>(null);

  return (
    <>
      <ProjectMaster
        kicker="Workforce"
        title="Workforce"
        subtitle="Choose a project to manage its workforce and assignments"
        actionLabel="View Workforce"
        onOpen={setOpenProject}
      />

      {openProject ? (
        <WorkforceDetail project={openProject} onClose={() => setOpenProject(null)} />
      ) : null}
    </>
  );
}
