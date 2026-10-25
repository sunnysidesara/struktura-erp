"use client";

import { useMemo, useState } from "react";
import { getAdminAssignments, type ApiAssignment } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  formatDate,
  useApiData,
  type SaColumn,
  type SaSortState,
} from "@/app/portal/dashboard/sa/_components/SaPage";

export default function AssignmentsPage() {
  const { data, loading, error } = useApiData(getAdminAssignments);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [sort, setSort] = useState<SaSortState>(null);

  const assignments = useMemo<ApiAssignment[]>(() => data ?? [], [data]);

  const projectNames = useMemo(
    () =>
      Array.from(new Set(assignments.map((row) => row.project).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [assignments],
  );

  // Keep phase options relevant to the selected project.
  const phaseNames = useMemo(() => {
    const scoped =
      projectFilter === "all"
        ? assignments
        : assignments.filter((row) => row.project === projectFilter);

    return Array.from(new Set(scoped.map((row) => row.phase).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [assignments, projectFilter]);

  const filtered = useMemo(
    () =>
      assignments.filter((row) => {
        const term = search.trim().toLowerCase();
        const worker = `${row.first_name} ${row.last_name}`.toLowerCase();
        const matchesSearch = !term || worker.includes(term);
        const matchesProject =
          projectFilter === "all" || row.project === projectFilter;
        const matchesPhase = phaseFilter === "all" || row.phase === phaseFilter;

        return matchesSearch && matchesProject && matchesPhase;
      }),
    [assignments, phaseFilter, projectFilter, search],
  );

  const sorted = useMemo(() => {
    if (!sort) return filtered;

    const direction = sort.direction === "asc" ? 1 : -1;
    const valueFor = (row: ApiAssignment, key: string) => {
      switch (key) {
        case "laborer":
          return `${row.first_name} ${row.last_name}`;
        case "project":
          return row.project;
        case "phase":
          return row.phase ?? "";
        case "assigned":
          return row.assigned_at ?? "";
        case "status":
          return row.status ?? "";
        default:
          return "";
      }
    };

    return [...filtered].sort(
      (a, b) =>
        direction * valueFor(a, sort.key).localeCompare(valueFor(b, sort.key)),
    );
  }, [filtered, sort]);

  const columns: SaColumn<ApiAssignment>[] = [
    {
      key: "laborer",
      label: "Laborer",
      sortable: true,
      render: (row) => `${row.first_name} ${row.last_name}`,
    },
    { key: "project", label: "Project", sortable: true, render: (row) => row.project },
    { key: "phase", label: "Phase", sortable: true, render: (row) => row.phase },
    { key: "assigned", label: "Assigned", sortable: true, render: (row) => formatDate(row.assigned_at) },
    {
      key: "status",
      label: "Status",
      status: true,
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const changeProject = (value: string) => {
    setProjectFilter(value);
    setPhaseFilter("all");
  };

  return (
    <SaPage
      kicker="Operations"
      title="Assignments"
      subtitle="Laborers assigned to project phases"
    >
      <SaPanel
        title={`Workforce Assignments (${filtered.length})`}
        filters={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search assignments by worker name"
            />
            <select
              value={projectFilter}
              onChange={(event) => changeProject(event.target.value)}
              aria-label="Filter assignments by project"
            >
              <option value="all">All Projects</option>
              {projectNames.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
            <select
              value={phaseFilter}
              onChange={(event) => setPhaseFilter(event.target.value)}
              aria-label="Filter assignments by phase"
              disabled={phaseNames.length === 0}
            >
              <option value="all">All Phases</option>
              {phaseNames.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
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
            assignments.length === 0
              ? "No assignments recorded."
              : "No assignments match your search or filters."
          }
          rowKey={(row) => row.assignment_id}
          sort={sort}
          onSortChange={setSort}
        />
      </SaPanel>
    </SaPage>
  );
}
