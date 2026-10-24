"use client";

import { ProjectSwitcher } from "../../_components/ProjectSwitcher";
import { selectPmProject, usePmProject } from "./projectSelection";

/**
 * Header control for the Project Manager: replaces the global search bar with
 * a "My Projects" switcher that drives every PM screen.
 */
export function PmProjectSwitcher() {
  const { projects, selectedId, loading, error } = usePmProject();

  return (
    <ProjectSwitcher
      label="My Projects"
      items={projects.map((project) => ({
        id: project.project_id,
        title: project.project_name,
        code: project.code,
        meta: `${project.location ?? "-"} · ${project.progress}% complete · ${
          project.status ?? "-"
        }`,
      }))}
      selectedId={selectedId}
      loading={loading}
      error={error}
      emptyText="No project is assigned to you yet. Create one from the Project page."
      onSelect={selectPmProject}
    />
  );
}
