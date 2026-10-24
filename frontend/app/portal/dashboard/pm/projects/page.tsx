"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listPmProjects, listPmSiteSupervisors, type PmProject, type PmSupervisor } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  money,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { ProjectModal } from "./ProjectModal";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

export default function AllProjectsPage() {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [supervisors, setSupervisors] = useState<PmSupervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notice, setNotice] = useState<Notice>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PmProject | null>(null);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listPmProjects()
      .then((data) => {
        setProjects(data);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load projects."),
      )
      .finally(() => setLoading(false));

    // Dropdown options are live Site Supervisor accounts.
    listPmSiteSupervisors()
      .then(setSupervisors)
      .catch(() => setSupervisors([]));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Status options come straight from the loaded rows (no hardcoded list).
  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((project) => project.status)
            .filter((status): status is string => Boolean(status)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [projects],
  );

  const rows = projects.filter((project) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      project.project_name.toLowerCase().includes(term) ||
      (project.client_name ?? "").toLowerCase().includes(term) ||
      (project.location ?? "").toLowerCase().includes(term);
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (project: PmProject) => {
    setEditing(project);
    setModalOpen(true);
  };

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setEditing(null);
    setNotice({ type: "success", message });
    load();
  };

  const columns: SaColumn<PmProject>[] = [
    {
      key: "project",
      label: "Project",
      render: (row) => (
        <span>
          {row.project_name}
          <span style={{ display: "block", color: "#94a3b8", fontSize: "0.7rem" }}>{row.code}</span>
        </span>
      ),
    },
    { key: "supervisor", label: "Site Supervisor", render: (row) => row.site_supervisor || "Unassigned" },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: "progress", label: "Progress", render: (row) => `${row.progress}%` },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button type="button" className={styles.linkButton} onClick={() => setDetail({
            title: row.project_name,
            rows: [
              { label: "Project ID", value: row.code },
              { label: "Client", value: row.client_name ?? "-" },
              { label: "Location", value: row.location ?? "-" },
              { label: "Site Supervisor", value: row.site_supervisor || "Unassigned" },
              { label: "Start", value: row.start_date ?? "-" },
              { label: "Target End", value: row.end_date ?? "-" },
              { label: "Deadline", value: row.deadline ?? "-" },
              { label: "Phases", value: row.phase_count },
              { label: "Approved Budget", value: money(row.approved_budget) },
              { label: "Spent", value: money(row.spent_budget) },
              { label: "Remaining", value: money(row.remaining_budget) },
              { label: "Status", value: row.status ?? "-" },
            ],
          })}>
            View
          </button>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => openEdit(row)}
          >
            Edit
          </button>
        </div>
      ),
    },
  ];

  return (
    <SaPage
      kicker="My Projects"
      title="All Projects"
      subtitle="Projects assigned to you as Project Manager"
      actions={
        <button type="button" className={styles.primaryButton} onClick={openCreate}>
          + New Project
        </button>
      }
    >
      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel
        title={`Projects (${rows.length})`}
        filters={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search projects"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
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
          rows={rows}
          loading={loading}
          error={error}
          emptyText={
            projects.length === 0
              ? "No projects yet. Use + New Project to create your first one."
              : "No projects match your search or filter."
          }
          rowKey={(row) => row.project_id}
        />
      </SaPanel>

      <ProjectModal
        open={modalOpen}
        project={editing}
        supervisors={supervisors}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Project details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </SaPage>
  );
}
