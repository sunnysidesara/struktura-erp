"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getAdminDashboard,
  listUsers,
  roleCodeFromName,
  type ApiDashboardData,
  type ApiUserRow,
} from "@/lib/api";
import {
  MetricCard,
  MetricGrid,
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  formatDate,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "./page.module.css";

const ROLE_LABELS: Record<string, string> = {
  Admin: "System Administrator",
  "Project Manager": "Project Manager",
  "Site Supervisor": "Site Supervisor",
};

type UserRowView = ApiUserRow & { roleLabel: string; roleCode: string };

export default function SystemAdminDashboard() {
  const [dashboard, setDashboard] = useState<ApiDashboardData | null>(null);
  const [users, setUsers] = useState<ApiUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    let active = true;

    Promise.all([getAdminDashboard(), listUsers()])
      .then(([dash, userList]) => {
        if (!active) return;
        setDashboard(dash);
        setUsers(userList);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const metrics = dashboard?.metrics;
  const roles = dashboard?.roles ?? {};
  const activity = dashboard?.activity ?? [];
  const recent = dashboard?.recent ?? [];
  const maxActivity = Math.max(1, ...activity.map((item) => item.total));
  const totalRoleUsers = Object.values(roles).reduce((sum, value) => sum + value, 0) || 1;

  const rows = useMemo<UserRowView[]>(
    () => users.map((user) => ({
      ...user,
      roleLabel: ROLE_LABELS[user.role_name ?? ""] ?? (user.role_name ?? "-"),
      roleCode: roleCodeFromName(user.role_name) ?? "SA",
    })),
    [users],
  );

  const filtered = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || row.full_name.toLowerCase().includes(term) || row.id_number.toLowerCase().includes(term);
    const matchesRole = roleFilter === "all" || row.roleCode === roleFilter;
    return matchesSearch && matchesRole;
  });

  const columns: SaColumn<UserRowView>[] = [
    { key: "id", label: "User ID", render: (row) => row.id_number },
    { key: "name", label: "Full Name", render: (row) => row.full_name },
    { key: "role", label: "Role", render: (row) => row.roleLabel },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.is_active ? "Active" : "Inactive"} /> },
    { key: "last", label: "Last Login", render: (row) => row.last_login_at ? formatDate(row.last_login_at) : "Never" },
  ];

  return (
    <SaPage
      kicker="Management Console"
      title="System Overview"
      subtitle="Full administrative control"
      actions={<Link className={styles.primaryButton} href="/portal/dashboard/sa/users?create=1">+ Create User</Link>}
    >
      {error ? <p className={styles.alert}>{error}</p> : null}

      <MetricGrid>
        <MetricCard label="Total Users" value={loading ? "..." : metrics?.total_users ?? 0} note={`${metrics?.active_users ?? 0} active`} />
        <MetricCard label="Active Sessions" value={loading ? "..." : metrics?.active_sessions ?? 0} note="Issued API tokens" />
        <MetricCard label="Skills Defined" value={loading ? "..." : metrics?.skills ?? 0} note="Trade catalog" />
        <MetricCard label="Audit Events Today" value={loading ? "..." : metrics?.audit_events_today ?? 0} note="Changes recorded today" />
      </MetricGrid>

      <section className={styles.analyticsGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><span>User Activity (Last 30 Days)</span></div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "0.35rem", height: "180px", padding: "1rem 1.5rem 0" }}>
            {activity.length === 0 ? (
              <span style={{ color: "#64748b" }}>No activity recorded.</span>
            ) : (
              activity.map((day, index) => (
                <div key={day.day} title={`${day.day}: ${day.total}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <span style={{ display: "block", height: `${Math.max(6, (day.total / maxActivity) * 100)}%`, background: index % 3 === 0 ? "#ca8a04" : "#1e3a8a", borderRadius: "4px 4px 0 0" }} />
                </div>
              ))
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 1.5rem 1rem", color: "#64748b", fontSize: "0.7rem" }}>
            <span>{activity[0]?.day ?? ""}</span>
            <span>{activity[activity.length - 1]?.day ?? ""}</span>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}><span>Roles Distribution</span></div>
          <div className={styles.roleChartRow}>
            <div className={styles.roleDistribution}>
              <strong>{metrics?.total_users ?? 0}</strong>
              <small>USERS</small>
            </div>
            <div style={{ flex: 1 }}>
              <div className={styles.distributionBar} style={{ display: "flex", height: "10px", borderRadius: "999px", overflow: "hidden", background: "#e2e8f0" }}>
                <span style={{ width: `${((roles.Admin ?? 0) / totalRoleUsers) * 100}%`, background: "#1e3a8a" }} />
                <span style={{ width: `${((roles["Project Manager"] ?? 0) / totalRoleUsers) * 100}%`, background: "#ca8a04" }} />
                <span style={{ width: `${((roles["Site Supervisor"] ?? 0) / totalRoleUsers) * 100}%`, background: "#334155" }} />
              </div>
              <ul className={styles.chartLegend}>
                <li><i className={styles.legendSa} /> System Admin <strong>{roles.Admin ?? 0}</strong></li>
                <li><i className={styles.legendPm} /> Project Manager <strong>{roles["Project Manager"] ?? 0}</strong></li>
                <li><i className={styles.legendSs} /> Site Supervisor <strong>{roles["Site Supervisor"] ?? 0}</strong></li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}><span>Recent System Activity</span></div>
          <ul className={styles.activityList}>
            {recent.length === 0 ? (
              <li>No recent activity.</li>
            ) : (
              recent.map((item) => (
                <li key={item.id}>
                  <span className={styles.activityTime}>{formatDate(item.charge_at)}</span>
                  <span>{item.action_type} on {item.table_name} #{item.record_id}{item.project_name ? ` (${item.project_name})` : ""}</span>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>

      <SaPanel
        title="User Management"
        filters={<>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All Roles</option>
            <option value="SA">System Administrator</option>
            <option value="PM">Project Manager</option>
            <option value="SS">Site Supervisor</option>
          </select>
        </>}
      >
        <SaTable columns={columns} rows={filtered} loading={loading} error={error} rowKey={(row) => row.user_id} />
        <div style={{ padding: "0 1.5rem 1.5rem" }}>
          <Link className={styles.linkButton} href="/portal/dashboard/sa/users">View all users</Link>
        </div>
      </SaPanel>
    </SaPage>
  );
}
