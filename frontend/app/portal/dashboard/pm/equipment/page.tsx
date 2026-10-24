"use client";

import { useState } from "react";
import type { PmProject } from "@/lib/api";
import { ProjectMaster } from "../_components/ProjectMaster";
import { UsageDetail } from "../_components/UsageDetail";

export default function EquipmentPage() {
  const [openProject, setOpenProject] = useState<PmProject | null>(null);

  return (
    <>
      <ProjectMaster
        kicker="Resources"
        title="Equipment"
        subtitle="Choose a project to review and log its equipment usage"
        actionLabel="View Equipment"
        onOpen={setOpenProject}
      />

      {openProject ? (
        <UsageDetail project={openProject} kind="equipment" onClose={() => setOpenProject(null)} />
      ) : null}
    </>
  );
}
