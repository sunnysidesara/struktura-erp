"use client";

import { useEffect, useState } from "react";
import { listPmSiteSupervisors, type PmProject, type PmSupervisor } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { usePmProject } from "./_components/projectSelection";
import { ProjectModal } from "./projects/ProjectModal";
import pmStyles from "./page.module.css";
import styles from "../sa/page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

export default function ProjectManagerOverview() {
  const { projects, selectedId, selected, loading, error, select, reload } = usePmProject();
  const [supervisors, setSupervisors] = useState<PmSupervisor[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // Needed by the create form to attach an active Site Supervisor.
  useEffect(() => {
    listPmSiteSupervisors()
      .then(setSupervisors)
      .catch(() => setSupervisors([]));
  }, []);

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setNotice({ type: "success", message });
    reload();
  };

  const columns: SaColumn<PmProject>[] = [
    { key: "code", label: "Project ID", render: (row) => row.code },
    { key: "name", label: "Project", render: (row) => row.project_name },
    { key: "progress", label: "Progress", render: (row) => `${row.progress}%` },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          {row.project_id === selectedId ? (
            <span className={pmStyles.selectedBadge}>Selected</span>
          ) : (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => select(row.project_id)}
            >
              Select
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <SaPage
      kicker="Project Workspace"
      title="Overview"
      subtitle={
        selected
          ? `Working on ${selected.code} · ${selected.project_name}`
          : "Pick a project below to unlock your workspace."
      }
      actions={
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setModalOpen(true)}
        >
          + Create Project
        </button>
      }
    >
      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel title="Welcome">
        <div className={pmStyles.welcomeBody}>
          <p className={pmStyles.welcomeHead}>Welcome back to your project workspace.</p>
          <p className={pmStyles.welcomeText}>
            Select one of your projects from the table below or from &ldquo;My Projects&rdquo; in the
            header. Once a project is selected, the sidebar unlocks so you can open its phases,
            finance, assignments, materials and equipment.
          </p>
        </div>
      </SaPanel>

      <SaPanel title={`My Projects (${projects.length})`}>
        <SaTable
          columns={columns}
          rows={projects}
          loading={loading}
          error={error}
          emptyText="No project is assigned to you yet. Create one from the Project page."
          rowKey={(row) => row.project_id}
        />
      </SaPanel>

      <ProjectModal
        open={modalOpen}
        project={null}
        supervisors={supervisors}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </SaPage>
  );
}
