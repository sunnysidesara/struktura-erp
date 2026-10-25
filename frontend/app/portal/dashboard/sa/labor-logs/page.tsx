"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAdminProjects,
  getSsLogHours,
  type ApiProject,
  type SsLaborLog,
} from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  money,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../page.module.css";

/** Admin projects do not return a `code`, so derive the PRJ-#### label. */
const projectCode = (project: ApiProject) =>
  `PRJ-${String(project.project_id).padStart(4, "0")}`;

const columns: SaColumn<SsLaborLog>[] = [
  { key: "worker", label: "Worker", render: (row) => row.worker },
  { key: "phase", label: "Phase", render: (row) => row.phase ?? "-" },
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "shift", label: "Shift", render: (row) => row.shift },
  {
    key: "times",
    label: "Time In / Out",
    render: (row) => `${row.time_in ?? "-"} - ${row.time_out ?? "-"}`,
  },
  { key: "hours", label: "Hours", render: (row) => `${row.total} h` },
  { key: "cost", label: "Computed Cost", render: (row) => money(row.expense) },
];

export default function AdminLaborLogsPage() {
  const {
    data: projectData,
    loading: projectsLoading,
    error: projectsError,
  } = useApiData(getAdminProjects);
  const projects = useMemo<ApiProject[]>(() => projectData ?? [], [projectData]);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedId === null && projects.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(projects[0].project_id);
    }
  }, [projects, selectedId]);

  const selected =
    projects.find((project) => project.project_id === selectedId) ?? null;

  return (
    <SaPage
      kicker="Operations"
      title="Labor Logs"
      subtitle={
        selected
          ? `${projectCode(selected)} · ${selected.project_name}`
          : "Review labor-hour logs across projects."
      }
    >
      {projectsError ? <p className={styles.alert}>{projectsError}</p> : null}

      <SaPanel
        title="Project"
        filters={
          <select
            value={selectedId ?? ""}
            onChange={(event) =>
              setSelectedId(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            disabled={projectsLoading || projects.length === 0}
            aria-label="Select project"
          >
            {projects.length === 0 ? <option value="">No projects</option> : null}
            {projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {projectCode(project)} - {project.project_name}
              </option>
            ))}
          </select>
        }
      >
        <p className={styles.muted}>
          {selected
            ? `Showing labor-hour logs for ${selected.project_name}.`
            : "Select a project to review its labor-hour logs."}
        </p>
      </SaPanel>

      {selectedId !== null ? (
        <LaborLogsTable key={selectedId} projectId={selectedId} />
      ) : null}
    </SaPage>
  );
}

function LaborLogsTable({ projectId }: { projectId: number }) {
  const { data, loading, error } = useApiData(() => getSsLogHours(projectId));
  const logs = data?.logs ?? [];

  return (
    <SaPanel title={`Labor Logs (${logs.length})`}>
      <p className={styles.muted}>Showing the latest 60 labor-hour logs.</p>
      <SaTable
        columns={columns}
        rows={logs}
        loading={loading}
        error={error}
        emptyText="No labor logs recorded for this project yet."
        rowKey={(row) => row.log_id}
      />
    </SaPanel>
  );
}
