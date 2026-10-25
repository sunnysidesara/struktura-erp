"use client";

import { useEffect, useState } from "react";
import { listPmProjects, type PmProject } from "@/lib/api";
import { ProjectMaster } from "../_components/ProjectMaster";
import { selectPmProject } from "../_components/projectSelection";
import { WorkforceDetail } from "./WorkforceDetail";

export default function WorkforcePage() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [openProject, setOpenProject] = useState<PmProject | null>(null);

  useEffect(() => {
    listPmProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  const openSite = (project: PmProject) => {
    setOpenProject(project);
    selectPmProject(project.project_id);
  };

  return (
    <>
      <ProjectMaster
        kicker="Workforce"
        title="Workforce"
        subtitle="Choose a project to manage its workforce and assignments"
        actionLabel="View Workforce"
        onOpen={openSite}
      />

      {openProject ? (
        <WorkforceDetail
          project={openProject}
          projects={projects.some((project) => project.project_id === openProject.project_id)
            ? projects
            : [openProject]}
          onProjectChange={openSite}
          onClose={() => setOpenProject(null)}
        />
      ) : null}
    </>
  );
}
