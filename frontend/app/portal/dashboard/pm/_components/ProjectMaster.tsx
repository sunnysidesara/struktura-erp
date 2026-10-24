"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listPmProjects, type PmProject } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../../sa/page.module.css";

/**
 * Master list shared by the Phases / Materials / Equipment / Assignments /
 * Finance pages: searchable, status-filtered list of the PM's projects.
 * Clicking the ID or the name opens the detail popup.
 */
export function ProjectMaster({
  kicker,
  title,
  subtitle,
  actionLabel = "View Details",
  onOpen,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onOpen: (project: PmProject) => void;
}) {
  const [projects, setProjects] = useState<PmProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((project) => project.status)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [projects],
  );

  const rows = projects.filter((project) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term === "" ||
      project.project_name.toLowerCase().includes(term) ||
      project.code.toLowerCase().includes(term) ||
      (project.client_name ?? "").toLowerCase().includes(term) ||
      (project.location ?? "").toLowerCase().includes(term);

    return matchesSearch && (status === "all" || project.status === status);
  });

  const columns: SaColumn<PmProject>[] = [
    {
      key: "code",
      label: "Project ID",
      render: (row) => (
        <button type="button" className={styles.linkButton} onClick={() => onOpen(row)}>
          {row.code}
        </button>
      ),
    },
    {
      key: "name",
      label: "Project Name",
      render: (row) => (
        <button type="button" className={styles.linkButton} onClick={() => onOpen(row)}>
          {row.project_name}
        </button>
      ),
    },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <button type="button" className={styles.linkButtonAlt} onClick={() => onOpen(row)}>
          {actionLabel}
        </button>
      ),
    },
  ];

  return (
    <SaPage kicker={kicker} title={title} subtitle={subtitle}>
      <SaPanel
        title={`Projects (${rows.length})`}
        filters={
          <>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search projects"
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
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
              ? "No projects assigned to you yet."
              : "No projects match your search or filter."
          }
          rowKey={(row) => row.project_id}
        />
      </SaPanel>
    </SaPage>
  );
}
