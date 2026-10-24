"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listPmAssignments,
  listPmPhases,
  type PmAssignment,
  type PmPhase,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import pmStyles from "../page.module.css";

/** Read-only assignment list for one project, filterable by phase. */
export function AssignmentsPanel({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<PmAssignment[]>([]);
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([listPmAssignments(projectId), listPmPhases(projectId)])
      .then(([assignmentList, phaseList]) => {
        if (!active) return;
        setRows(assignmentList);
        setPhases(phaseList);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load assignments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  const visible = useMemo(
    () =>
      phaseFilter === "all"
        ? rows
        : rows.filter((row) => String(row.phase_id) === phaseFilter),
    [rows, phaseFilter],
  );

  const columns: SaColumn<PmAssignment>[] = [
    { key: "worker", label: "Worker Name", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "phase", label: "Phase Assigned", render: (row) => row.phase },
    { key: "role", label: "Role on Task", render: (row) => row.role_on_task ?? "-" },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <SaPanel
      title={`Assigned workers (${visible.length})`}
      filters={
        <>
          <span className={pmStyles.filterLabel}>Filter by Phase</span>
          <select
            value={phaseFilter}
            onChange={(event) => setPhaseFilter(event.target.value)}
            aria-label="Filter assignments by phase"
          >
            <option value="all">All Phases</option>
            {phases.map((phase) => (
              <option key={phase.phase_id} value={phase.phase_id}>
                {phase.sequence_no}. {phase.phase_name}
              </option>
            ))}
          </select>
        </>
      }
    >
      <SaTable
        columns={columns}
        rows={visible}
        loading={loading}
        error={error}
        emptyText={
          phaseFilter === "all"
            ? "No laborers are assigned to this project yet."
            : "No laborers are assigned to this phase."
        }
        rowKey={(row) => row.assignment_id}
      />
    </SaPanel>
  );
}
