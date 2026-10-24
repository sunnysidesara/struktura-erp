"use client";

import { getSsSites, type SsSiteOption } from "@/lib/api";
import { createProjectScope } from "../../_components/projectScope";

/**
 * Global "which site is the supervisor looking at" store. Shared by the header
 * "My Sites" switcher, the sidebar lock state and every SS screen.
 */
const scope = createProjectScope<SsSiteOption>({
  storageKey: "struktura.ss.selectedProjectId",
  loadItems: async () => (await getSsSites()).data ?? [],
  getId: (site) => site.project_id,
});

export const loadSsSites = scope.load;
export const selectSsSite = scope.select;
export const resetSsSelection = scope.reset;

/** `sites` stays as an alias so screens can keep their existing wording. */
export function useSsSite(enabled = true) {
  const value = scope.useScope(enabled);

  return { ...value, sites: value.items };
}
