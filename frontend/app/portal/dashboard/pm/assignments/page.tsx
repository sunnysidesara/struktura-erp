"use client";

import { useState } from "react";
import type { PmProject } from "@/lib/api";
import { ProjectMaster } from "../_components/ProjectMaster";
import { AssignmentsDetail } from "./AssignmentsDetail";

export default function AssignmentsPage() {
  const [openProject, setOpenProject] = useState<PmProject | null>(null);

  return (
    <>
      <ProjectMaster
        kicker="Operations"
        title="Assignments"
        subtitle="Choose a project to review its worker assignments by phase"
        actionLabel="View Assignments"
        onOpen={setOpenProject}
      />

      {openProject ? (
        <AssignmentsDetail project={openProject} onClose={() => setOpenProject(null)} />
      ) : null}
    </>
  );
}
