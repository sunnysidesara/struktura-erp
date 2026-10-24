"use client";

import { useState } from "react";
import { getAdminPhases, type ApiPhase } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  money,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";

export default function PhasesPage() {
  const { data, loading, error } = useApiData(getAdminPhases);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

  const phases = data ?? [];

  const projectNames = Array.from(
    new Set(phases.map((phase) => phase.project).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const filtered = phases.filter((phase) => {
    const term = search.trim().toLowerCase();
    // `project_name` holds the phase name in this payload.
    const matchesSearch =
      !term || (phase.project_name ?? "").toLowerCase().includes(term);
    const matchesProject =
      projectFilter === "all" || phase.project === projectFilter;

    return matchesSearch && matchesProject;
  });

  const columns: SaColumn<ApiPhase>[] = [
    { key: "project", label: "Project", render: (row) => row.project },
    { key: "phase", label: "Phase", render: (row) => row.project_name ?? "-" },
    {
      key: "planned",
      label: "Planned",
      render: (row) => `${row.planned_start ?? "-"} → ${row.planned_end ?? "-"}`,
    },
    { key: "cost", label: "Cost", render: (row) => money(row.project_cost) },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <SaPage
      kicker="Operations"
      title="Phases"
      subtitle="Sequenced stages across all projects"
    >
      <SaPanel
        title={`Project Phases (${filtered.length})`}
        filters={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search phases by name"
            />
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              aria-label="Filter phases by project"
            >
              <option value="all">All Projects</option>
              {projectNames.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </>
        }
      >
        <SaTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          emptyText={
            phases.length === 0
              ? "No phases recorded."
              : "No phases match your search or filter."
          }
          rowKey={(row) => row.phase_id}
        />
      </SaPanel>
    </SaPage>
  );
}
