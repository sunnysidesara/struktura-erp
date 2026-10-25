"use client";

import { useMemo, useState } from "react";
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
  const [dateSort, setDateSort] = useState<"asc" | "desc">("asc");

  const phases = useMemo<ApiPhase[]>(() => data ?? [], [data]);

  const projectNames = Array.from(
    new Set(phases.map((phase) => phase.project).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const filtered = useMemo(
    () =>
      phases.filter((phase) => {
        const term = search.trim().toLowerCase();
        // `project_name` holds the phase name in this payload.
        const matchesSearch =
          !term || (phase.project_name ?? "").toLowerCase().includes(term);
        const matchesProject =
          projectFilter === "all" || phase.project === projectFilter;

        return matchesSearch && matchesProject;
      }),
    [phases, projectFilter, search],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aDate = a.planned_start;
        const bDate = b.planned_start;

        // Keep undated phases at the bottom in both directions.
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;

        return dateSort === "asc"
          ? aDate.localeCompare(bDate)
          : bDate.localeCompare(aDate);
      }),
    [dateSort, filtered],
  );

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
            <select
              value={dateSort}
              onChange={(event) =>
                setDateSort(event.target.value === "desc" ? "desc" : "asc")
              }
              aria-label="Sort phases by planned start date"
            >
              <option value="asc">Date: Ascending</option>
              <option value="desc">Date: Descending</option>
            </select>
          </>
        }
      >
        <SaTable
          columns={columns}
          rows={sorted}
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
