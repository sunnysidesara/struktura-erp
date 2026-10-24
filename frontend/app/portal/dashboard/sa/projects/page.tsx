"use client";

import { useState } from "react";
import { getAdminProjects, type ApiProject } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  money,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";

export default function ProjectsPage() {
  const { data, loading, error } = useApiData(getAdminProjects);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const projects = data ?? [];

  // Real statuses present in the data (Active, Completed, Delayed, ...).
  const statuses = Array.from(
    new Set(
      projects
        .map((project) => project.status)
        .filter((status): status is string => Boolean(status)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const filtered = projects.filter((project) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term || project.project_name.toLowerCase().includes(term);
    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const columns: SaColumn<ApiProject>[] = [
    { key: "name", label: "Project", render: (row) => row.project_name },
    {
      key: "manager",
      label: "Manager",
      render: (row) =>
        row.manager_id
          ? `${row.manager_id} - ${row.manager_first_name ?? ""} ${row.manager_last_name ?? ""}`.trim()
          : "-",
    },
    { key: "budget", label: "Approved Budget", render: (row) => money(row.approved_budget) },
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
      title="All Projects"
      subtitle="Every project with its manager, budget and phase count"
    >
      <SaPanel
        title={`Projects (${filtered.length})`}
        filters={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search projects by name"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter projects by status"
            >
              <option value="all">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
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
            projects.length === 0
              ? "No projects recorded."
              : "No projects match your search or filter."
          }
          rowKey={(row) => row.project_id}
        />
      </SaPanel>
    </SaPage>
  );
}
