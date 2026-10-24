"use client";

import { useState } from "react";
import { getAdminAssignments, type ApiAssignment } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  formatDate,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";

const PAIR_SEPARATOR = "||";

function pairKey(row: ApiAssignment): string {
  return `${row.project}${PAIR_SEPARATOR}${row.phase}`;
}

export default function AssignmentsPage() {
  const { data, loading, error } = useApiData(getAdminAssignments);
  const [search, setSearch] = useState("");
  const [pairFilter, setPairFilter] = useState("all");

  const assignments = data ?? [];

  // Unique project + phase combinations present in the data.
  const pairs = Array.from(
    new Map(
      assignments.map((row) => [pairKey(row), `${row.project} - ${row.phase}`]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = assignments.filter((row) => {
    const term = search.trim().toLowerCase();
    const worker = `${row.first_name} ${row.last_name}`.toLowerCase();
    const matchesSearch = !term || worker.includes(term);
    const matchesPair = pairFilter === "all" || pairKey(row) === pairFilter;

    return matchesSearch && matchesPair;
  });

  const columns: SaColumn<ApiAssignment>[] = [
    {
      key: "laborer",
      label: "Laborer",
      render: (row) => `${row.first_name} ${row.last_name}`,
    },
    { key: "project", label: "Project", render: (row) => row.project },
    { key: "phase", label: "Phase", render: (row) => row.phase },
    { key: "assigned", label: "Assigned", render: (row) => formatDate(row.assigned_at) },
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
              value={pairFilter}
              onChange={(event) => setPairFilter(event.target.value)}
              aria-label="Filter assignments by project and phase"
            >
              <option value="all">All Projects &amp; Phases</option>
              {pairs.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
            assignments.length === 0
              ? "No assignments recorded."
              : "No assignments match your search or filter."
          }
          rowKey={(row) => row.assignment_id}
        />
      </SaPanel>
    </SaPage>
  );
}
