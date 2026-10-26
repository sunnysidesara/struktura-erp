"use client";

import { useEffect, useState } from "react";
import {
  getPmDashboard,
  getStoredUser,
  listPmSiteSupervisors,
  type PmDashboard,
  type PmProject,
  type PmSupervisor,
} from "@/lib/api";
import {
  MetricCard,
  MetricGrid,
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  Tabs,
  formatDate,
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
  const [dashboard, setDashboard] = useState<PmDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [overviewTab, setOverviewTab] = useState<"projects" | "deadlines">("projects");

  // Needed by the create form to attach an active Site Supervisor.
  useEffect(() => {
    listPmSiteSupervisors()
      .then(setSupervisors)
      .catch(() => setSupervisors([]));
  }, []);

  // KPI summary for the role dashboard; refreshed after a project is saved.
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDashboardLoading(true);

    getPmDashboard()
      .then((data) => {
        if (!active) return;
        setDashboard(data);
        setDashboardError("");
      })
      .catch((err) => {
        if (active) {
          setDashboardError(
            err instanceof Error ? err.message : "Failed to load dashboard metrics.",
          );
        }
      })
      .finally(() => {
        if (active) setDashboardLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dashboardRefresh]);

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setNotice({ type: "success", message });
    reload();
    setDashboardRefresh((current) => current + 1);
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

  const deadlineColumns: SaColumn<PmProject>[] = [
    { key: "code", label: "Project ID", render: (row) => row.code },
    { key: "name", label: "Project", render: (row) => row.project_name },
    { key: "deadline", label: "Deadline", render: (row) => row.deadline ? formatDate(row.deadline) : "-" },
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

  const metrics = dashboard?.metrics;
  const deadlines = dashboard?.deadlines ?? [];
  const storedUser = getStoredUser();
  const welcomeName = storedUser
    ? `${storedUser.first_name} ${storedUser.last_name}`.trim()
    : "Project Manager";
  const count = (value: number | undefined) =>
    dashboardLoading ? "..." : dashboard ? (value ?? 0) : "-";

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

      {dashboardError ? (
        <p className={pmStyles.noticeError}>{dashboardError}</p>
      ) : null}

      <SaPanel title="Welcome">
        <div className={pmStyles.welcomeBody}>
          <p className={pmStyles.welcomeHead}>Welcome, {welcomeName}.</p>
          <p className={pmStyles.welcomeText}>
            Select one of your projects from the table below or from &ldquo;My Projects&rdquo; in the
            header. Once a project is selected, the sidebar unlocks so you can open its phases,
            finance, materials and equipment.
          </p>
        </div>
      </SaPanel>

      <MetricGrid>
        <MetricCard
          label="Projects"
          value={count(metrics?.projects)}
          note={
            dashboardLoading
              ? "Loading..."
              : `${metrics?.active_projects ?? 0} active · ${metrics?.completed_projects ?? 0} completed`
          }
        />
        <MetricCard
          label="Active Projects"
          value={count(metrics?.active_projects)}
          note="Currently in progress"
        />
        <MetricCard
          label="Open Phases"
          value={count(metrics?.open_phases)}
          note="Phases not yet completed"
        />
      </MetricGrid>

      <Tabs
        items={[
          { id: "projects", label: "My Projects" },
          { id: "deadlines", label: "Upcoming Deadlines" },
        ]}
        active={overviewTab}
        onChange={setOverviewTab}
        label="Project overview views"
      />

      <SaPanel
        title={
          overviewTab === "projects"
            ? `My Projects (${projects.length})`
            : `Upcoming Deadlines (${deadlines.length})`
        }
      >
        <SaTable
          columns={overviewTab === "projects" ? columns : deadlineColumns}
          rows={overviewTab === "projects" ? projects : deadlines}
          loading={overviewTab === "projects" ? loading : dashboardLoading}
          error={overviewTab === "projects" ? error : dashboardError}
          emptyText={
            overviewTab === "projects"
              ? "No project is assigned to you yet. Create one from the Project page."
              : "No upcoming project deadlines."
          }
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
