"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSsSites, type SsSiteOption } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../../sa/page.module.css";

/**
 * Master list for the Site Supervisor console: only the sites assigned to the
 * signed-in supervisor, with search + status filter.
 */
export function SiteMaster({
  kicker,
  title,
  subtitle,
  actionLabel,
  onOpen,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  onOpen: (site: SsSiteOption) => void;
}) {
  const [sites, setSites] = useState<SsSiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    getSsSites()
      .then((response) => {
        setSites(response.data);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load your sites."),
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
        new Set(sites.map((site) => site.status).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b)),
    [sites],
  );

  const rows = sites.filter((site) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term === "" ||
      site.project.toLowerCase().includes(term) ||
      site.code.toLowerCase().includes(term) ||
      (site.location ?? "").toLowerCase().includes(term);

    return matchesSearch && (status === "all" || site.status === status);
  });

  const columns: SaColumn<SsSiteOption>[] = [
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
      key: "project",
      label: "Project Name",
      render: (row) => (
        <button type="button" className={styles.linkButton} onClick={() => onOpen(row)}>
          {row.project}
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
        title={`My Sites (${rows.length})`}
        filters={
          <>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search sites"
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
            sites.length === 0
              ? "No site is assigned to you yet. Ask your Project Manager."
              : "No sites match your search or filter."
          }
          rowKey={(row) => row.project_id}
        />
      </SaPanel>
    </SaPage>
  );
}
