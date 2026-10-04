"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

type UserInfo = {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
};

type UserRow = {
  userId: string;
  fullName: string;
  role: "System Administrator" | "Project Manager" | "Site Supervisor";
  status: "Active" | "Inactive";
  lastLogin: string;
};

type AuditEntry = {
  time: string;
  message: string;
};

// Mock data for SA system management. Replace with fetch('/api/users') later.
// This unrestricted view is exclusive to the System Administrator role.
const users: UserRow[] = [
  {
    userId: "SA101",
    fullName: "Alicia Mendoza",
    role: "System Administrator",
    status: "Active",
    lastLogin: "2026-10-04 09:45",
  },
  {
    userId: "PM101",
    fullName: "Marcus Dela Cruz",
    role: "Project Manager",
    status: "Active",
    lastLogin: "2026-10-04 08:20",
  },
  {
    userId: "SS101",
    fullName: "Rafael Santos",
    role: "Site Supervisor",
    status: "Active",
    lastLogin: "2026-10-04 07:40",
  },
  {
    userId: "PM102",
    fullName: "Leah Ramos",
    role: "Project Manager",
    status: "Inactive",
    lastLogin: "2026-09-30 13:15",
  },
  {
    userId: "SS102",
    fullName: "Bryan Santos",
    role: "Site Supervisor",
    status: "Active",
    lastLogin: "2026-10-02 16:50",
  },
  {
    userId: "SS103",
    fullName: "Nina Santos",
    role: "Site Supervisor",
    status: "Active",
    lastLogin: "2026-10-03 11:25",
  },
  {
    userId: "SA102",
    fullName: "Carlos Reyes",
    role: "System Administrator",
    status: "Active",
    lastLogin: "2026-10-04 06:12",
  },
  {
    userId: "PM103",
    fullName: "Jessa Valdez",
    role: "Project Manager",
    status: "Active",
    lastLogin: "2026-10-04 14:05",
  },
];

const roleCards = [
  {
    title: "SYSTEM ADMINISTRATOR (SA)",
    description: "Can: manage users, roles, all projects, system data",
    users: 2,
    action: "Edit Permissions",
  },
  {
    title: "PROJECT MANAGER (PM)",
    description: "Can: manage projects, workforce, budgets, materials",
    users: 4,
    action: "Edit Permissions",
  },
  {
    title: "SITE SUPERVISOR (SS)",
    description: "Can: record daily labor, materials, equipment",
    users: 6,
    action: "Edit Permissions",
  },
];

const projects = [
  {
    name: "Bridge Phase 2",
    manager: "PM101",
    progress: 72,
    budget: "₱ 2,400,000",
    status: "On Track",
  },
  {
    name: "North Tower Residences",
    manager: "PM102",
    progress: 46,
    budget: "₱ 1,850,000",
    status: "Delayed",
  },
  {
    name: "Harbor Logistics Hub",
    manager: "PM103",
    progress: 88,
    budget: "₱ 3,100,000",
    status: "On Track",
  },
  {
    name: "Roadway Rehabilitation",
    manager: "PM101",
    progress: 100,
    budget: "₱ 1,200,000",
    status: "Completed",
  },
  {
    name: "Campus Utility Upgrade",
    manager: "PM103",
    progress: 60,
    budget: "₱ 980,000",
    status: "On Track",
  },
];

const systemActivity: AuditEntry[] = [
  { time: "2026-10-04 14:32", message: "SA101 created user SS107" },
  {
    time: "2026-10-04 13:15",
    message: 'PM101 created project "Bridge Phase 2"',
  },
  { time: "2026-10-04 11:48", message: "SS103 submitted daily record" },
  { time: "2026-10-04 10:22", message: "PM103 updated resource allocation" },
  { time: "2026-10-04 09:17", message: "SA102 changed role permissions" },
  { time: "2026-10-04 08:49", message: "SS102 completed safety checklist" },
  { time: "2026-10-04 08:05", message: "PM101 approved material request" },
  { time: "2026-10-04 07:40", message: "SA101 synced user access table" },
];

export default function SystemAdminDashboard() {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("struktura_user");

    if (storedUser) {
      setUser(JSON.parse(storedUser) as UserInfo);
    }
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.heroRow}>
          <div>
            <p className={styles.kicker}>Management Console</p>
            <h1 className={styles.title}>System Overview</h1>
            <p className={styles.subtitle}>Full administrative control</p>
          </div>
          <button type="button" className={styles.primaryButton}>
            + Create User
          </button>
        </header>

        <section className={styles.metricGrid} id="overview">
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Users</span>
            <strong className={styles.metricValue}>128</strong>
            <small className={styles.metricNote}>+2 this week</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Active Sessions</span>
            <strong className={styles.metricValue}>24</strong>
            <small className={styles.metricNote}>+4 since yesterday</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Skills Defined</span>
            <strong className={styles.metricValue}>36</strong>
            <small className={styles.metricNote}>+3 this month</small>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Audit Events Today</span>
            <strong className={styles.metricValue}>246</strong>
            <small className={styles.metricNote}>+18% from yesterday</small>
          </article>
        </section>

        <section className={styles.analyticsGrid} id="analytics">
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>User Activity (Last 30 Days)</span>
            </div>
            <div
              className={styles.activityChart}
              role="img"
              aria-label="Mock user activity over the last 30 days"
            >
              {[
                34, 46, 39, 58, 49, 65, 53, 72, 60, 78, 68, 88, 74, 94, 82, 100,
                87, 76, 91, 69, 84, 73, 96, 81, 89, 70, 98, 83, 92, 100,
              ].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className={styles.chartAxis}>
              <span>Sep 5</span>
              <span>Sep 15</span>
              <span>Oct 4</span>
            </div>
          </article>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Roles Distribution</span>
            </div>
            <div className={styles.roleChartRow}>
              <div
                className={styles.roleDistribution}
                role="img"
                aria-label="Roles distribution: 16 percent administrators, 34 percent project managers, 50 percent site supervisors"
              >
                <strong>
                  128 <small>USERS</small>
                </strong>
                <div className={styles.distributionBar}>
                  <span className={styles.legendSa} style={{ width: "16%" }} />
                  <span className={styles.legendPm} style={{ width: "34%" }} />
                  <span className={styles.legendSs} style={{ width: "50%" }} />
                </div>
              </div>
              <ul className={styles.chartLegend}>
                <li>
                  <i className={styles.legendSa} /> System Admin{" "}
                  <strong>16%</strong>
                </li>
                <li>
                  <i className={styles.legendPm} /> Project Manager{" "}
                  <strong>34%</strong>
                </li>
                <li>
                  <i className={styles.legendSs} /> Site Supervisor{" "}
                  <strong>50%</strong>
                </li>
              </ul>
            </div>
          </article>
        </section>

        <section className={styles.panel} id="user-management">
          <div className={styles.panelHeader}>
            <span>User Management</span>
            <div className={styles.filterRow}>
              <input type="text" placeholder="Search user" />
              <select defaultValue="all">
                <option value="all">All Roles</option>
                <option value="SA">System Administrator</option>
                <option value="PM">Project Manager</option>
                <option value="SS">Site Supervisor</option>
              </select>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((entry) => (
                  <tr key={entry.userId}>
                    <td>{entry.userId}</td>
                    <td>{entry.fullName}</td>
                    <td>{entry.role}</td>
                    <td>
                      <span
                        className={
                          entry.status === "Active"
                            ? styles.statusActive
                            : styles.statusInactive
                        }
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td>{entry.lastLogin}</td>
                    <td>
                      <div className={styles.actionCell}>
                        <button type="button" className={styles.linkButton}>
                          Edit
                        </button>
                        <button type="button" className={styles.linkButtonAlt}>
                          Reset
                        </button>
                        <button type="button" className={styles.linkButton}>
                          Disable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel} id="roles">
          <div className={styles.panelHeader}>
            <span>Roles & Permissions</span>
          </div>
          <div className={styles.roleGrid}>
            {roleCards.map((role) => (
              <article className={styles.roleCard} key={role.title}>
                <h3>{role.title}</h3>
                <p>{role.description}</p>
                <div className={styles.roleMeta}>
                  <span>Users: {role.users}</span>
                </div>
                <button type="button" className={styles.roleAction}>
                  {role.action}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.panel} id="all-projects">
          <div className={styles.panelHeader}>
            <span>All Projects</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Manager</th>
                  <th>Progress</th>
                  <th>Budget</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.name}>
                    <td>{project.name}</td>
                    <td>{project.manager}</td>
                    <td>
                      <div className={styles.progressWrap}>
                        <span className={styles.progressTrack} />
                        <span
                          className={styles.progressFill}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <small>{project.progress}%</small>
                    </td>
                    <td>{project.budget}</td>
                    <td>
                      <span
                        className={
                          project.status === "On Track"
                            ? styles.statusActive
                            : project.status === "Delayed"
                              ? styles.statusWarning
                              : styles.statusCompleted
                        }
                      >
                        {project.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.bottomGrid}>
          <article className={styles.panel} id="audit-logs">
            <div className={styles.panelHeader}>
              <span>Recent Audit Logs</span>
            </div>
            <ul className={styles.activityList}>
              {systemActivity.slice(0, 6).map((entry) => (
                <li key={`${entry.time}-${entry.message}`}>
                  <span className={styles.activityTime}>[{entry.time}]</span>
                  <span>{entry.message}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className={styles.panel} id="database-performance">
            <div className={styles.panelHeader}>
              <span>Database Performance</span>
            </div>
            <div className={styles.performanceGrid}>
              <div>
                <span>Query Time</span>
                <strong>42 ms</strong>
                <small>−8 ms this week</small>
              </div>
              <div>
                <span>Active Connections</span>
                <strong>18 / 50</strong>
                <small>Within capacity</small>
              </div>
              <div>
                <span>Cache Hit</span>
                <strong>98.4%</strong>
                <small>+1.2% this week</small>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
