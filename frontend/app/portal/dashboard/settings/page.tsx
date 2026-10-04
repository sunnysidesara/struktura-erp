"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./page.module.css";

type UserRole = "SA" | "PM" | "SS";
type TabId =
  | "profile"
  | "appearance"
  | "notifications"
  | "security"
  | "language"
  | "system"
  | "advanced";
type NotificationKey =
  | "newTask"
  | "phaseCompleted"
  | "budgetAlerts"
  | "dailySummary"
  | "weeklyDigest"
  | "taskUpdates"
  | "mentions"
  | "announcements";
type AccountUser = {
  user_id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  email?: string;
  contact?: string;
};
type Preferences = {
  theme: string;
  collapseSidebar: boolean;
  sidebarWidth: string;
  fontFamily: string;
  fontSize: string;
  notifications: Record<NotificationKey, boolean>;
  emailDigest: string;
  twoFactor: boolean;
  loginAlerts: boolean;
  language: string;
  timeZone: string;
  dateFormat: string;
  timeFormat: string;
  defaultLanding: string;
  recordsPerPage: string;
  autoSave: string;
  sessionTimeout: string;
  passwordPolicy: string;
  forcePasswordChange: boolean;
  auditRetention: string;
  debugMode: boolean;
  apiRateLimit: string;
  testDataMode: boolean;
};

type ToggleProps = { checked: boolean; label: string; onChange: () => void };

const initialPreferences: Preferences = {
  theme: "light",
  collapseSidebar: false,
  sidebarWidth: "240px",
  fontFamily: "Arial",
  fontSize: "14",
  notifications: {
    newTask: true,
    phaseCompleted: true,
    budgetAlerts: true,
    dailySummary: false,
    weeklyDigest: true,
    taskUpdates: true,
    mentions: true,
    announcements: true,
  },
  emailDigest: "Daily",
  twoFactor: false,
  loginAlerts: true,
  language: "English",
  timeZone: "Asia/Manila",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "24-hour",
  defaultLanding: "/portal/dashboard/sa",
  recordsPerPage: "10",
  autoSave: "60 seconds",
  sessionTimeout: "30 minutes",
  passwordPolicy: "Strict",
  forcePasswordChange: true,
  auditRetention: "365 days",
  debugMode: false,
  apiRateLimit: "1000 req/hr",
  testDataMode: false,
};

const roleLabels: Record<UserRole, string> = {
  SA: "System Administrator",
  PM: "Project Manager",
  SS: "Site Supervisor",
};

const notificationOptions: { key: NotificationKey; label: string }[] = [
  { key: "newTask", label: "New task assigned" },
  { key: "phaseCompleted", label: "Phase completed" },
  { key: "budgetAlerts", label: "Budget threshold alerts" },
  { key: "dailySummary", label: "Daily summary report" },
  { key: "weeklyDigest", label: "Weekly digest" },
  { key: "taskUpdates", label: "Task updates" },
  { key: "mentions", label: "Mentions and comments" },
  { key: "announcements", label: "System announcements" },
];

const iconPaths: Record<TabId, string> = {
  profile:
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  appearance:
    "M12 3a9 9 0 1 0 9 9c0-1-1-2-2-2h-2a2 2 0 0 1-2-2c0-1 1-2 1-3 0-1-2-2-4-2Zm-4 9h.01M8 8h.01m8 8h.01",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4",
  security: "M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Zm-3 9 2 2 4-4",
  language:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18m-9-9a14 14 0 0 1 0 18m0-18a14 14 0 0 0 0 18",
  system:
    "M4 4h16v16H4zM8 8h8v8H8zM2 9h2m16 0h2M2 15h2m16 0h2M9 2v2m6-2v2m-6 16v2m6-2v2",
  advanced: "M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Zm0 5v4m0 4h.01",
};

const tabOptions: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "language", label: "Language & Region" },
  { id: "system", label: "System" },
  { id: "advanced", label: "Advanced" },
];

function ToggleSwitch({ checked, label, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={
        checked ? `${styles.switch} ${styles.switchOn}` : styles.switch
      }
      onClick={onChange}
    >
      <span />
    </button>
  );
}

function TabIcon({ id }: { id: TabId }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconPaths[id]} />
    </svg>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [preferences, setPreferences] =
    useState<Preferences>(initialPreferences);
  const [notice, setNotice] = useState("");
  const [sessions, setSessions] = useState([
    {
      id: "chrome-win",
      device: "Chrome / Windows",
      location: "Manila, PH",
      active: "2 min ago",
    },
    {
      id: "safari-mac",
      device: "Safari / macOS",
      location: "Cebu, PH",
      active: "3 days ago",
    },
  ]);
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  useEffect(() => {
    const rawUser = localStorage.getItem("struktura_user");
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as Partial<AccountUser>;
        if (
          parsed.role === "SA" ||
          parsed.role === "PM" ||
          parsed.role === "SS"
        ) {
          setUser({
            user_id: parsed.user_id ?? "",
            role: parsed.role,
            first_name: parsed.first_name ?? "",
            last_name: parsed.last_name ?? "",
            email: parsed.email,
            contact: parsed.contact,
          });
        }
      } catch {
        setUser(null);
      }
    }

    const rawPreferences = localStorage.getItem("struktura_settings");
    if (rawPreferences) {
      try {
        const saved = JSON.parse(rawPreferences) as Partial<Preferences>;
        setPreferences((current) => ({
          ...current,
          ...saved,
          notifications: { ...current.notifications, ...saved.notifications },
        }));
      } catch {
        setNotice("Saved preferences could not be loaded.");
      }
    }
  }, []);

  const availableTabs = tabOptions.filter(
    (tab) =>
      user?.role === "SA" || (tab.id !== "system" && tab.id !== "advanced"),
  );

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Loading settings...</p>
      </main>
    );
  }

  const updatePreference = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const save = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    localStorage.setItem("struktura_settings", JSON.stringify(preferences));
    setNotice("Changes saved successfully");
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const updatedUser = {
      ...user,
      first_name: event.currentTarget.firstName.value,
      last_name: event.currentTarget.lastName.value,
      email: event.currentTarget.email.value,
      contact: event.currentTarget.contact.value,
    };
    localStorage.setItem(
      "struktura_user",
      JSON.stringify({
        ...JSON.parse(localStorage.getItem("struktura_user") ?? "{}"),
        ...updatedUser,
      }),
    );
    setUser(updatedUser);
    setNotice("Changes saved successfully");
  };

  const toggleNotification = (key: NotificationKey) => {
    setPreferences((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        [key]: !current.notifications[key],
      },
    }));
  };

  const toggleRow = (label: string, checked: boolean, onChange: () => void) => (
    <div className={styles.toggleRow} key={label}>
      <span>{label}</span>
      <ToggleSwitch checked={checked} label={label} onChange={onChange} />
    </div>
  );

  const selectField = (
    label: string,
    value: string,
    options: string[],
    onChange: (value: string) => void,
  ) => (
    <label className={styles.field} key={label}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );

  const renderActivePanel = () => {
    switch (activeTab) {
      case "profile":
        return (
          <>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Personal Information</h2>
              <form onSubmit={saveProfile}>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>First Name</span>
                    <input
                      name="firstName"
                      defaultValue={user.first_name}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Last Name</span>
                    <input
                      name="lastName"
                      defaultValue={user.last_name}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Email</span>
                    <input
                      name="email"
                      type="email"
                      defaultValue={user.email ?? ""}
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Contact Number</span>
                    <input
                      name="contact"
                      type="tel"
                      defaultValue={user.contact ?? ""}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Role</span>
                    <input value={roleLabels[user.role]} readOnly />
                  </label>
                </div>
                <div className={styles.actions}>
                  <button type="submit" className={styles.primaryButton}>
                    Save Changes
                  </button>
                  <button type="reset" className={styles.outlineButton}>
                    Cancel
                  </button>
                </div>
              </form>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Change Password</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setPasswords({ current: "", next: "", confirm: "" });
                  setNotice("Password update is ready for API integration.");
                }}
              >
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Current Password</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={passwords.current}
                      onChange={(event) =>
                        setPasswords((value) => ({
                          ...value,
                          current: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>New Password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={passwords.next}
                      onChange={(event) =>
                        setPasswords((value) => ({
                          ...value,
                          next: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Confirm Password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={passwords.confirm}
                      onChange={(event) =>
                        setPasswords((value) => ({
                          ...value,
                          confirm: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className={styles.strength}>
                  <span
                    style={{
                      width: `${Math.min(passwords.next.length * 10, 100)}%`,
                    }}
                  />
                  <small>
                    {passwords.next.length >= 12
                      ? "Strong"
                      : passwords.next.length >= 8
                        ? "Medium"
                        : "Enter a new password"}
                  </small>
                </div>
                <div className={styles.actions}>
                  <button type="submit" className={styles.primaryButton}>
                    Update Password
                  </button>
                  <button
                    type="reset"
                    className={styles.outlineButton}
                    onClick={() =>
                      setPasswords({ current: "", next: "", confirm: "" })
                    }
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </>
        );
      case "appearance":
        return (
          <form onSubmit={save} className={styles.panelStack}>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Theme</h2>
              <div className={styles.radioRow}>
                {["Light", "Dark", "System Default"].map((theme) => (
                  <label className={styles.radioOption} key={theme}>
                    <input
                      type="radio"
                      name="theme"
                      checked={preferences.theme === theme.toLowerCase()}
                      onChange={() =>
                        updatePreference("theme", theme.toLowerCase())
                      }
                    />
                    {theme}
                  </label>
                ))}
              </div>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Sidebar Preferences</h2>
              {toggleRow(
                "Collapse sidebar by default",
                preferences.collapseSidebar,
                () =>
                  updatePreference(
                    "collapseSidebar",
                    !preferences.collapseSidebar,
                  ),
              )}
              {selectField(
                "Sidebar width",
                preferences.sidebarWidth,
                ["220px", "240px", "280px"],
                (value) => updatePreference("sidebarWidth", value),
              )}
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Typography</h2>
              <div className={styles.formGrid}>
                {selectField(
                  "Font family",
                  preferences.fontFamily,
                  ["Arial", "DM Sans", "Manrope"],
                  (value) => updatePreference("fontFamily", value),
                )}
                <label className={styles.field}>
                  <span>Base font size (px)</span>
                  <input
                    type="number"
                    min="12"
                    max="20"
                    value={preferences.fontSize}
                    onChange={(event) =>
                      updatePreference("fontSize", event.target.value)
                    }
                  />
                </label>
              </div>
            </section>
            <FormActions onCancel={() => setPreferences(initialPreferences)} />
          </form>
        );
      case "notifications":
        return (
          <form onSubmit={save} className={styles.panelStack}>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Email Notifications</h2>
              {notificationOptions
                .slice(0, 5)
                .map(({ key, label }) =>
                  toggleRow(label, preferences.notifications[key], () =>
                    toggleNotification(key),
                  ),
                )}
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>In-App Notifications</h2>
              {notificationOptions
                .slice(5)
                .map(({ key, label }) =>
                  toggleRow(label, preferences.notifications[key], () =>
                    toggleNotification(key),
                  ),
                )}
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Notification Frequency</h2>
              {selectField(
                "Email digest",
                preferences.emailDigest,
                ["Immediately", "Daily", "Weekly"],
                (value) => updatePreference("emailDigest", value),
              )}
            </section>
            <FormActions onCancel={() => setPreferences(initialPreferences)} />
          </form>
        );
      case "security":
        return (
          <form onSubmit={save} className={styles.panelStack}>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>
                Two-Factor Authentication
              </h2>
              <div className={styles.toggleRow}>
                <span>{preferences.twoFactor ? "Enabled" : "Not enabled"}</span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() =>
                    updatePreference("twoFactor", !preferences.twoFactor)
                  }
                >
                  {preferences.twoFactor ? "Disable 2FA" : "Enable 2FA"}
                </button>
              </div>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Active Sessions</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Location</th>
                      <th>Last Active</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>{session.device}</td>
                        <td>{session.location}</td>
                        <td>{session.active}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => {
                              setSessions((items) =>
                                items.filter((item) => item.id !== session.id),
                              );
                              setNotice("Session revoked");
                            }}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className={styles.outlineButton}
                onClick={() => {
                  setSessions([]);
                  setNotice("Other sessions signed out");
                }}
              >
                Sign out all other sessions
              </button>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Login Alerts</h2>
              {toggleRow(
                "Email me on new device login",
                preferences.loginAlerts,
                () => updatePreference("loginAlerts", !preferences.loginAlerts),
              )}
            </section>
            <FormActions onCancel={() => setPreferences(initialPreferences)} />
          </form>
        );
      case "language":
        return (
          <form onSubmit={save} className={styles.panel}>
            <h2 className={styles.sectionHeading}>Language &amp; Region</h2>
            <div className={styles.formGrid}>
              {selectField(
                "Language",
                preferences.language,
                ["English", "Filipino"],
                (value) => updatePreference("language", value),
              )}
              {selectField(
                "Time Zone",
                preferences.timeZone,
                ["Asia/Manila", "UTC"],
                (value) => updatePreference("timeZone", value),
              )}
              {selectField(
                "Date Format",
                preferences.dateFormat,
                ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"],
                (value) => updatePreference("dateFormat", value),
              )}
              {selectField(
                "Time Format",
                preferences.timeFormat,
                ["24-hour", "12-hour"],
                (value) => updatePreference("timeFormat", value),
              )}
            </div>
            <FormActions onCancel={() => setPreferences(initialPreferences)} />
          </form>
        );
      case "system":
        return user.role === "SA" ? (
          <form onSubmit={save} className={styles.panelStack}>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>System Preferences</h2>
              <div className={styles.formGrid}>
                {selectField(
                  "Default Landing Page",
                  preferences.defaultLanding,
                  [
                    "/portal/dashboard/sa",
                    "/portal/dashboard/pm",
                    "/portal/dashboard/ss",
                  ],
                  (value) => updatePreference("defaultLanding", value),
                )}
                {selectField(
                  "Records Per Page",
                  preferences.recordsPerPage,
                  ["10", "25", "50", "100"],
                  (value) => updatePreference("recordsPerPage", value),
                )}
                {selectField(
                  "Auto-save Interval",
                  preferences.autoSave,
                  ["30 seconds", "60 seconds", "5 minutes"],
                  (value) => updatePreference("autoSave", value),
                )}
                {selectField(
                  "Session Timeout",
                  preferences.sessionTimeout,
                  ["15 minutes", "30 minutes", "60 minutes"],
                  (value) => updatePreference("sessionTimeout", value),
                )}
              </div>
            </section>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>System-Wide Defaults</h2>
              <div className={styles.formGrid}>
                {selectField(
                  "Password Policy Preset",
                  preferences.passwordPolicy,
                  ["Standard", "Strict"],
                  (value) => updatePreference("passwordPolicy", value),
                )}
                <label className={styles.field}>
                  <span>Audit Log Retention</span>
                  <input
                    value={preferences.auditRetention}
                    onChange={(event) =>
                      updatePreference("auditRetention", event.target.value)
                    }
                  />
                </label>
              </div>
              {toggleRow(
                "Force Change on First Login",
                preferences.forcePasswordChange,
                () =>
                  updatePreference(
                    "forcePasswordChange",
                    !preferences.forcePasswordChange,
                  ),
              )}
            </section>
            <FormActions onCancel={() => setPreferences(initialPreferences)} />
          </form>
        ) : null;
      case "advanced":
        return user.role === "SA" ? (
          <form onSubmit={save} className={styles.panelStack}>
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Developer Options</h2>
              {toggleRow("Enable Debug Mode", preferences.debugMode, () =>
                updatePreference("debugMode", !preferences.debugMode),
              )}
              <label className={styles.field}>
                <span>API Rate Limit</span>
                <input
                  value={preferences.apiRateLimit}
                  onChange={(event) =>
                    updatePreference("apiRateLimit", event.target.value)
                  }
                />
              </label>
              {toggleRow(
                "Enable Test Data Mode",
                preferences.testDataMode,
                () =>
                  updatePreference("testDataMode", !preferences.testDataMode),
              )}
            </section>
            <section className={styles.dangerPanel}>
              <h2 className={styles.sectionHeading}>Danger Zone</h2>
              <p>These mock actions do not alter system data.</p>
              <div className={styles.actionList}>
                {["Clear Cache", "Reindex Database", "Reset All Sessions"].map(
                  (action) => (
                    <button
                      type="button"
                      className={styles.outlineButton}
                      key={action}
                      onClick={() =>
                        setNotice(`${action} requested (mock action).`)
                      }
                    >
                      {action}
                    </button>
                  ),
                )}
              </div>
            </section>
            <FormActions onCancel={() => setPreferences(initialPreferences)} />
          </form>
        ) : null;
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your account preferences</p>
        </div>
        <span className={styles.rolePill}>{roleLabels[user.role]}</span>
      </header>
      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      ) : null}
      <div className={styles.settingsLayout}>
        <nav className={styles.tabList} aria-label="Settings sections">
          {availableTabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={
                activeTab === tab.id
                  ? `${styles.tab} ${styles.tabActive}`
                  : styles.tab
              }
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon id={tab.id} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className={styles.settingsContent}>{renderActivePanel()}</div>
      </div>
    </main>
  );
}

function FormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className={styles.actions}>
      <button type="submit" className={styles.primaryButton}>
        Save Changes
      </button>
      <button type="button" className={styles.outlineButton} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
