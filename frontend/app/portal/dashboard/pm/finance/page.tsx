"use client";

import { useState } from "react";
import type { PmProject } from "@/lib/api";
import { ProjectMaster } from "../_components/ProjectMaster";
import { FinanceDetail } from "./FinanceDetail";

export default function FinancePage() {
  const [openProject, setOpenProject] = useState<PmProject | null>(null);

  return (
    <>
      <ProjectMaster
        kicker="Finance"
        title="Finance"
        subtitle="Choose a project to review its budget and cost breakdown"
        actionLabel="View Finance"
        onOpen={setOpenProject}
      />

      {openProject ? (
        <FinanceDetail project={openProject} onClose={() => setOpenProject(null)} />
      ) : null}
    </>
  );
}
