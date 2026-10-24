"use client";

import { ProjectSwitcher } from "../../_components/ProjectSwitcher";
import { selectSsSite, useSsSite } from "./siteSelection";

/**
 * Header control for the Site Supervisor: replaces the global search bar with
 * a "My Sites" switcher that drives every SS screen.
 */
export function SsSiteSwitcher() {
  const { sites, selectedId, loading, error } = useSsSite();

  return (
    <ProjectSwitcher
      label="My Sites"
      items={sites.map((site) => ({
        id: site.project_id,
        title: site.project,
        code: site.code,
        meta: `${site.location ?? "-"} · ${site.progress}% complete${
          site.status ? ` · ${site.status}` : ""
        }`,
      }))}
      selectedId={selectedId}
      loading={loading}
      error={error}
      emptyText="No site is assigned to this account yet. Ask your Project Manager to add you to a project."
      onSelect={selectSsSite}
    />
  );
}
