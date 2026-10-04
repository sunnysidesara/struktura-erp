"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type UserRole = "SA" | "PM" | "SS";
type AccountUser = {
  user_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  email?: string;
  contact?: string;
  department?: string;
  joined_at?: string;
};

type Permission = { text: string; allowed: boolean };

const roleLabels: Record<UserRole, string> = {
  SA: "System Administrator",
  PM: "Project Manager",
  SS: "Site Supervisor",
};

const roleDetails: Record<
  UserRole,
  {
    email: string;
    contact: string;
    department: string;
    joined: string;
    sessions: number;
    lastLogin: string;
  }
> = {
  SA: {
    email: "alicia.mendoza@struktura.com",
    contact: "+63 917 123 4567",
    department: "IT / Database",
    joined: "September 15, 2026",
    sessions: 42,
    lastLogin: "2 hours ago",
  },
  PM: {
    email: "marcus.delacruz@struktura.com",
    contact: "+63 918 234 5678",
    department: "Project Management",
    joined: "August 20, 2026",
    sessions: 38,
    lastLogin: "1 hour ago",
  },
  SS: {
    email: "rafael.santos@struktura.com",
    contact: "+63 919 345 6789",
    department: "Site Operations",
    joined: "September 2, 2026",
    sessions: 31,
    lastLogin: "Today, 7:40 AM",
  },
};

const roleDescriptions: Record<UserRole, string> = {
  SA: "As System Administrator, you have unrestricted access to all tables, system configuration, and database security profiles. You can manage user accounts and roles, maintain master skill definitions, and monitor system-wide audit activity.",
  PM: "As Project Manager, you can create and edit construction projects, define phases and timelines, assign workers, and view project budgets and cost reports. You cannot modify user accounts or audit logs.",
  SS: "As Site Supervisor, you can view assigned worker rosters, log daily labor hours, record material and equipment usage, and view active task schedules. You do not have access to budgets, wage rates, or user credentials.",
};

const rolePermissions: Record<UserRole, Permission[]> = {
  SA: [
    { text: "Manage user accounts and access roles", allowed: true },
    { text: "Configure system and database security", allowed: true },
    { text: "Review system-wide audit activity", allowed: true },
    { text: "Restricted from system access", allowed: false },
  ],
  PM: [
    { text: "Manage assigned construction projects", allowed: true },
    { text: "Assign workers to project phases", allowed: true },
    { text: "Review project budgets and costs", allowed: true },
    { text: "Edit user accounts or audit logs", allowed: false },
  ],
  SS: [
    { text: "Record daily labor and site resources", allowed: true },
    { text: "View assigned workers and active phases", allowed: true },
    { text: "Review site task schedules", allowed: true },
    { text: "View budgets, wage rates, or user credentials", allowed: false },
  ],
};

const loginHistory = [
  {
    date: "Oct 4, 2026 · 14:32",
    ip: "192.168.1.45",
    device: "Chrome / Windows",
    success: true,
  },
  {
    date: "Oct 4, 2026 · 08:15",
    ip: "192.168.1.45",
    device: "Chrome / Windows",
    success: true,
  },
  {
    date: "Oct 3, 2026 · 17:22",
    ip: "192.168.1.22",
    device: "Safari / macOS",
    success: true,
  },
  {
    date: "Oct 3, 2026 · 09:04",
    ip: "10.0.0.15",
    device: "Chrome / Windows",
    success: false,
  },
  {
    date: "Oct 2, 2026 · 16:48",
    ip: "192.168.1.45",
    device: "Chrome / Windows",
    success: true,
  },
  {
    date: "Oct 2, 2026 · 07:56",
    ip: "192.168.1.45",
    device: "Chrome / Windows",
    success: true,
  },
  {
    date: "Oct 1, 2026 · 18:11",
    ip: "192.168.1.22",
    device: "Safari / macOS",
    success: true,
  },
  {
    date: "Oct 1, 2026 · 08:02",
    ip: "192.168.1.45",
    device: "Chrome / Windows",
    success: true,
  },
];

function Mark({ good }: { good: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={good ? styles.markGood : styles.markBad}
      viewBox="0 0 20 20"
      fill="none"
    >
      {good ? <path d="m4 10 4 4 8-8" /> : <path d="m5 5 10 10M15 5 5 15" />}
    </svg>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [contact, setContact] = useState("");
  const [editingContact, setEditingContact] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("struktura_user");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<AccountUser>;
      if (parsed.role !== "SA" && parsed.role !== "PM" && parsed.role !== "SS")
        return;
      const account: AccountUser = {
        user_id: parsed.user_id ?? "",
        role: parsed.role,
        first_name: parsed.first_name ?? "",
        last_name: parsed.last_name ?? "",
        email: parsed.email,
        contact: parsed.contact,
        department: parsed.department,
        joined_at: parsed.joined_at,
      };
      setUser(account);
      setContact(account.contact ?? roleDetails[account.role].contact);
    } catch {
      setUser(null);
    }
  }, []);

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Loading profile...</p>
      </main>
    );
  }

  const details = roleDetails[user.role];
  const fullName =
    `${user.first_name} ${user.last_name}`.trim() || user.user_id;
  const email = user.email ?? details.email;

  const saveContact = () => {
    setUser((current) => (current ? { ...current, contact } : current));
    const raw = localStorage.getItem("struktura_user");
    if (raw) {
      try {
        localStorage.setItem(
          "struktura_user",
          JSON.stringify({ ...JSON.parse(raw), contact }),
        );
      } catch {
        setNotice("Could not save profile changes.");
        return;
      }
    }
    setEditingContact(false);
    setNotice("Changes saved successfully");
  };

  const signOutEverywhere = () => {
    localStorage.removeItem("struktura_token");
    localStorage.removeItem("struktura_user");
    router.replace("/portal");
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.subtitle}>
            Your account information and activity
          </p>
        </div>
        <button
          type="button"
          className={styles.outlineButton}
          onClick={() => setEditingContact((value) => !value)}
        >
          {editingContact ? "Cancel Edit" : "Edit Profile"}
        </button>
      </header>

      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}

      <section className={styles.identityCard}>
        <div
          className={styles.avatar}
          aria-hidden="true"
        >{`${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`}</div>
        <div className={styles.identityInfo}>
          <h2>{fullName}</h2>
          <div className={styles.badgeRow}>
            <span className={styles.userId}>{user.user_id}</span>
            <span
              className={`${styles.roleBadge} ${styles[`role${user.role}`]}`}
            >
              {roleLabels[user.role]}
            </span>
          </div>
          <p>{email}</p>
          <small>Member since: {user.joined_at ?? details.joined}</small>
        </div>
      </section>

      <section className={styles.kpiGrid} aria-label="Account activity summary">
        <article className={styles.kpiCard}>
          <span>Last Login</span>
          <strong>{details.lastLogin}</strong>
          <small>Oct 4, 2026 · 14:32</small>
        </article>
        <article className={styles.kpiCard}>
          <span>Total Sessions</span>
          <strong>{details.sessions}</strong>
          <small>This month</small>
        </article>
        <article className={styles.kpiCard}>
          <span>Account Status</span>
          <strong className={styles.activeStatus}>Active</strong>
          <small>In good standing</small>
        </article>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionHeading}>Account Details</h2>
        <dl className={styles.detailsGrid}>
          <div>
            <dt>Full Name</dt>
            <dd>{fullName}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{user.user_id}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabels[user.role]}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>Contact Number</dt>
            <dd>
              {editingContact ? (
                <input
                  className={styles.contactInput}
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  aria-label="Contact number"
                />
              ) : (
                contact
              )}
            </dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{user.department ?? details.department}</dd>
          </div>
          <div>
            <dt>Date Joined</dt>
            <dd>{user.joined_at ?? details.joined}</dd>
          </div>
          <div>
            <dt>Account Status</dt>
            <dd>
              <span className={styles.activeStatus}>Active</span>
            </dd>
          </div>
        </dl>
        {editingContact ? (
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={saveContact}
            >
              Save Contact
            </button>
            <button
              type="button"
              className={styles.outlineButton}
              onClick={() => {
                setContact(user.contact ?? details.contact);
                setEditingContact(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionHeading}>Your Role &amp; Permissions</h2>
        <p className={styles.roleDescription}>{roleDescriptions[user.role]}</p>
        <ul className={styles.permissionList}>
          {rolePermissions[user.role].map((permission) => (
            <li
              key={permission.text}
              className={
                permission.allowed
                  ? styles.permissionAllowed
                  : styles.permissionDenied
              }
            >
              <Mark good={permission.allowed} />
              <span>{permission.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionHeading}>Recent Login Activity</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>IP Address</th>
                <th>Device</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.map((entry) => (
                <tr key={`${entry.date}-${entry.ip}`}>
                  <td>{entry.date}</td>
                  <td>{entry.ip}</td>
                  <td>{entry.device}</td>
                  <td>
                    <span
                      className={
                        entry.success ? styles.loginSuccess : styles.loginFailed
                      }
                    >
                      {entry.success ? "Success" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {user.role === "SA" ? (
        <>
          <section className={styles.card}>
            <h2 className={styles.sectionHeading}>System Access Information</h2>
            <dl className={styles.detailsGrid}>
              <div>
                <dt>Database Role</dt>
                <dd>avnadmin</dd>
              </div>
              <div>
                <dt>Access Level</dt>
                <dd>Full (unrestricted)</dd>
              </div>
              <div>
                <dt>Audit Log Access</dt>
                <dd>Enabled</dd>
              </div>
              <div>
                <dt>DB Connection Role</dt>
                <dd>admin_all</dd>
              </div>
              <div>
                <dt>Last DB Query</dt>
                <dd>2 minutes ago</dd>
              </div>
              <div>
                <dt>Total Queries Today</dt>
                <dd>1,247</dd>
              </div>
            </dl>
          </section>
          <section className={styles.card}>
            <h2 className={styles.sectionHeading}>Security &amp; Compliance</h2>
            <dl className={styles.detailsGrid}>
              <div>
                <dt>2FA Status</dt>
                <dd>
                  {twoFactorEnabled ? "Enabled" : "Not enabled"}{" "}
                  {!twoFactorEnabled ? (
                    <button
                      type="button"
                      className={styles.inlineButton}
                      onClick={() => {
                        setTwoFactorEnabled(true);
                        setNotice("Two-factor authentication enabled");
                      }}
                    >
                      Enable
                    </button>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Password Last Set</dt>
                <dd>32 days ago</dd>
              </div>
              <div>
                <dt>Failed Login Attempts</dt>
                <dd>0</dd>
              </div>
              <div>
                <dt>Account Locked</dt>
                <dd>No</dd>
              </div>
            </dl>
          </section>
        </>
      ) : null}

      <section className={styles.dangerCard}>
        <div>
          <h2 className={styles.sectionHeading}>Sign out of all devices</h2>
          <p>
            This will end your current session and remove this account from this
            browser.
          </p>
        </div>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={signOutEverywhere}
        >
          Sign Out Everywhere
        </button>
      </section>
    </main>
  );
}
