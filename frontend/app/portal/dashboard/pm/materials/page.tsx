"use client";

import { useState } from "react";
import type { PmProject } from "@/lib/api";
import { ProjectMaster } from "../_components/ProjectMaster";
import { UsageDetail } from "../_components/UsageDetail";

export default function MaterialsPage() {
  const [openProject, setOpenProject] = useState<PmProject | null>(null);

  return (
    <>
      <ProjectMaster
        kicker="Resources"
        title="Materials"
        subtitle="Choose a project to review and log its material usage"
        actionLabel="View Materials"
        onOpen={setOpenProject}
      />

      {openProject ? (
        <UsageDetail project={openProject} kind="material" onClose={() => setOpenProject(null)} />
      ) : null}
    </>
  );
}
