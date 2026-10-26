"use client";

import { listPmProjects, type PmProject } from "@/lib/api";
import { createProjectScope } from "../../_components/projectScope";

/**
 * Global "which project is the manager looking at" store. Shared by the header
 * "My Projects" switcher, the sidebar lock state and every PM screen.
 */
const scope = createProjectScope<PmProject>({
  storageKey: "struktura.pm.selectedProjectId",
  loadItems: listPmProjects,
  getId: (project) => project.project_id,
});

export const loadPmProjects = scope.load;
export const selectPmProject = scope.select;
export const resetPmSelection = scope.reset;

/** `projects` is the PM-flavoured alias of `items`. */
export function usePmProject(enabled = true) {
  const value = scope.useScope(enabled);

  return { ...value, projects: value.items };
}
