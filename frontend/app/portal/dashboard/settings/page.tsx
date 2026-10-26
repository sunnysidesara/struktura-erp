"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  changePassword,
  clearSession,
  getStoredUser,
  logout as apiLogout,
  me,
  roleCodeFromName,
  updateProfile,
  USER_KEY,
  type RoleCode,
} from "@/lib/api";
import styles from "./page.module.css";

type TabId = "profile" | "security" | "notifications";
type NotificationKey = "newTask" | "phaseCompleted" | "announcements";
type Status = { type: "success" | "error"; message: string } | null;

type ProfileValues = {
  firstName: string;
  lastName: string;
  email: string;
  contact: string;
};

const EMPTY_PROFILE: ProfileValues = {
  firstName: "",
  lastName: "",
  email: "",
  contact: "",
};

const ROLE_LABELS: Record<RoleCode, string> = {
  SA: "System Administrator",
  PM: "Project Manager",
  SS: "Site Supervisor",
};

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
];

const TAB_ICONS: Record<TabId, string> = {
  profile:
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  security: "M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Zm-3 9 2 2 4-4",
  notifications: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4",
};

const NOTIFICATIONS_KEY = "struktura_notifications";

const NOTIFICATION_OPTIONS: { key: NotificationKey; label: string }[] = [
  { key: "newTask", label: "New task assigned" },
  { key: "phaseCompleted", label: "Phase completed" },
  { key: "announcements", label: "System announcements" },
];

const DEFAULT_NOTIFICATIONS: Record<NotificationKey, boolean> = {
  newTask: true,
  phaseCompleted: true,
  announcements: true,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Numeric contact: optional leading +, then 7-15 digits. */
const CONTACT_PATTERN = /^\+?\d{7,15}$/;

type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;
type PasswordErrors = { current?: string; next?: string; confirm?: string };

/** Read the saved toggles once, lazily, so no effect is needed. */
function readStoredNotifications(): Record<NotificationKey, boolean> {
  if (typeof window === "undefined") {
    return DEFAULT_NOTIFICATIONS;
  }

  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) {
      return DEFAULT_NOTIFICATIONS;
    }

    const saved = JSON.parse(raw) as Partial<Record<NotificationKey, boolean>>;
    return { ...DEFAULT_NOTIFICATIONS, ...saved };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

/** Pull the most useful message out of a failed API call. */
function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    const first = error.errors
      ? Object.values(error.errors)[0]?.[0]
      : undefined;
    return first ?? error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

/** Keep the cached session in sync so the header shows the updated name. */
function persistSessionName(first: string, last: string, email: string) {
  const stored = getStoredUser();
  if (!stored) {
    return;
  }

  window.localStorage.setItem(
    USER_KEY,
    JSON.stringify({ ...stored, first_name: first, last_name: last, email }),
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
      <path d={TAB_ICONS[id]} />
    </svg>
  );
}

function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
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

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [role, setRole] = useState<RoleCode | null>(null);

  const [profile, setProfile] = useState<ProfileValues>(EMPTY_PROFILE);
  const [profileStatus, setProfileStatus] = useState<Status>(null);
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [savingPassword, setSavingPassword] = useState(false);

  const [notifications, setNotifications] = useState<
    Record<NotificationKey, boolean>
  >(readStoredNotifications);
  const [notificationStatus, setNotificationStatus] = useState<Status>(null);

  // Load the freshest profile from the API; fall back to the cached session
  // when the backend is unreachable so the page still renders.
  useEffect(() => {
    let active = true;

    me()
      .then((user) => {
        if (!active) return;

        setAccountId(user.id_number);
        setRole(roleCodeFromName(user.role?.role_name));
        setProfile({
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          contact: user.contact_number ?? "",
        });
      })
      .catch(() => {
        if (!active) return;

        const stored = getStoredUser();
        if (!stored) return;

        setAccountId(stored.user_id);
        setRole(stored.role);
        setProfile({
          firstName: stored.first_name,
          lastName: stored.last_name,
          email: stored.email,
          contact: "",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateProfileField = (key: keyof ProfileValues, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setProfileErrors((current) => ({ ...current, [key]: undefined }));
    setProfileStatus(null);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileStatus(null);

    const firstName = profile.firstName.trim();
    const lastName = profile.lastName.trim();
    const email = profile.email.trim();
    const contactRaw = profile.contact.trim();
    // Normalize before validating so pasted "+63 917-123-4567" still works.
    const contact = contactRaw.replace(/[\s\-().]+/g, "");

    const errors: ProfileErrors = {};

    if (!firstName) {
      errors.firstName = "First name is required.";
    }
    if (!lastName) {
      errors.lastName = "Last name is required.";
    }
    if (!email) {
      errors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Enter a valid email address (e.g. name@company.com).";
    }
    if (contact !== "" && !CONTACT_PATTERN.test(contact)) {
      errors.contact =
        "Contact number must be numeric (7-15 digits, optional leading +).";
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      setProfileStatus({
        type: "error",
        message: "Please fix the highlighted fields.",
      });
      return;
    }

    setProfileErrors({});
    setSavingProfile(true);

    try {
      const user = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        email,
        contact_number: contact === "" ? null : contact,
      });

      setAccountId(user.id_number);
      setRole(roleCodeFromName(user.role?.role_name) ?? role);
      setProfile({
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        contact: user.contact_number ?? "",
      });
      persistSessionName(user.first_name, user.last_name, user.email);
      setProfileStatus({
        type: "success",
        message: "Changes saved successfully.",
      });
    } catch (error) {
      // Map server-side validation errors back onto their inputs.
      if (error instanceof ApiError && error.errors) {
        const mapped: ProfileErrors = {};
        const pick = (key: string) => error.errors?.[key]?.[0];

        const firstError = pick("first_name");
        const lastError = pick("last_name");
        const emailError = pick("email");
        const contactError = pick("contact_number");

        if (firstError) mapped.firstName = firstError;
        if (lastError) mapped.lastName = lastError;
        if (emailError) mapped.email = emailError;
        if (contactError) mapped.contact = contactError;

        if (Object.keys(mapped).length > 0) {
          setProfileErrors(mapped);
        }
      }

      setProfileStatus({ type: "error", message: messageFrom(error) });
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePasswordField = (
    key: "current" | "next" | "confirm",
    value: string,
  ) => {
    setPasswords((current) => ({ ...current, [key]: value }));
    setPasswordErrors((current) => ({ ...current, [key]: undefined }));
    setPasswordStatus(null);
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordStatus(null);

    const errors: PasswordErrors = {};

    if (!passwords.current) {
      errors.current = "Enter your current password.";
    }
    if (passwords.next.length < 12) {
      errors.next = "New password must be at least 12 characters.";
    } else if (passwords.next === passwords.current) {
      errors.next = "New password must be different from the current password.";
    }
    if (passwords.confirm !== passwords.next) {
      errors.confirm = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      setPasswordStatus({
        type: "error",
        message: "Please fix the highlighted fields.",
      });
      return;
    }

    setPasswordErrors({});
    setSavingPassword(true);

    try {
      await changePassword({
        current_password: passwords.current,
        password: passwords.next,
        password_confirmation: passwords.confirm,
      });

      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordStatus({
        type: "success",
        message: "Password changed successfully.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const mapped: PasswordErrors = {};
        const currentError = error.errors.current_password?.[0];
        const nextError = error.errors.password?.[0];

        if (currentError) mapped.current = currentError;
        if (nextError) mapped.next = nextError;

        if (Object.keys(mapped).length > 0) {
          setPasswordErrors(mapped);
        }
      }

      setPasswordStatus({ type: "error", message: messageFrom(error) });
    } finally {
      setSavingPassword(false);
    }
  };

  const toggleNotification = (key: NotificationKey) => {
    setNotifications((current) => {
      const next = { ...current, [key]: !current[key] };
      // Persist immediately so the toggle survives a refresh.
      window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
    setNotificationStatus({
      type: "success",
      message: "Notification preferences saved.",
    });
  };

  const saveNotifications = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.localStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(notifications),
    );
    setNotificationStatus({
      type: "success",
      message: "Notification preferences saved.",
    });
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // Token may already be invalid; clear the local session regardless.
    }

    clearSession();
    router.push("/portal");
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Loading settings...</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>
            Manage your profile, password and notifications
            {accountId ? ` \u00b7 ${accountId}` : ""}
          </p>
        </div>
        {role ? (
          <span className={styles.rolePill}>{ROLE_LABELS[role]}</span>
        ) : null}
      </header>

      <div className={styles.settingsLayout}>
        <nav className={styles.tabList} aria-label="Settings sections">
          {TABS.map((tab) => (
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

        <div className={styles.settingsContent}>
          {activeTab === "profile" ? (
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Profile</h2>
              <p className={styles.panelHint}>
                These details appear across the dashboard.
              </p>

              <form onSubmit={saveProfile}>
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>First Name</span>
                    <input
                      value={profile.firstName}
                      onChange={(event) =>
                        updateProfileField("firstName", event.target.value)
                      }
                      autoComplete="given-name"
                    />
                    {profileErrors.firstName ? (
                      <p className={styles.fieldError}>
                        {profileErrors.firstName}
                      </p>
                    ) : null}
                  </label>

                  <label className={styles.field}>
                    <span>Last Name</span>
                    <input
                      value={profile.lastName}
                      onChange={(event) =>
                        updateProfileField("lastName", event.target.value)
                      }
                      autoComplete="family-name"
                    />
                    {profileErrors.lastName ? (
                      <p className={styles.fieldError}>
                        {profileErrors.lastName}
                      </p>
                    ) : null}
                  </label>

                  <label className={styles.field}>
                    <span>Email</span>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(event) =>
                        updateProfileField("email", event.target.value)
                      }
                      autoComplete="email"
                    />
                    {profileErrors.email ? (
                      <p className={styles.fieldError}>{profileErrors.email}</p>
                    ) : null}
                  </label>

                  <label className={styles.field}>
                    <span>Contact Number</span>
                    <input
                      type="tel"
                      value={profile.contact}
                      onChange={(event) =>
                        updateProfileField("contact", event.target.value)
                      }
                      placeholder="+63 917 123 4567"
                      autoComplete="tel"
                    />
                    {profileErrors.contact ? (
                      <p className={styles.fieldError}>
                        {profileErrors.contact}
                      </p>
                    ) : null}
                  </label>

                  <label className={styles.field}>
                    <span>Role</span>
                    <input
                      value={role ? ROLE_LABELS[role] : ""}
                      className={styles.readOnlyInput}
                      readOnly
                    />
                  </label>
                </div>

                {profileStatus ? (
                  <p
                    className={
                      profileStatus.type === "error"
                        ? `${styles.status} ${styles.statusError}`
                        : `${styles.status} ${styles.statusSuccess}`
                    }
                    role="status"
                  >
                    {profileStatus.message}
                  </p>
                ) : null}

                <div className={styles.actions}>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {activeTab === "security" ? (
            <>
              <section className={styles.panel}>
                <h2 className={styles.sectionHeading}>Change Password</h2>
                <p className={styles.panelHint}>
                  Use at least 8 characters. Other devices will be signed out.
                </p>

                <form onSubmit={savePassword}>
                  <label className={styles.field}>
                    <span>Current Password</span>
                    <input
                      type="password"
                      value={passwords.current}
                      onChange={(event) =>
                        updatePasswordField("current", event.target.value)
                      }
                      autoComplete="current-password"
                    />
                    {passwordErrors.current ? (
                      <p className={styles.fieldError}>
                        {passwordErrors.current}
                      </p>
                    ) : null}
                  </label>

                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      <span>New Password</span>
                      <input
                        type="password"
                        value={passwords.next}
                        onChange={(event) =>
                          updatePasswordField("next", event.target.value)
                        }
                        autoComplete="new-password"
                      />
                      {passwordErrors.next ? (
                        <p className={styles.fieldError}>
                          {passwordErrors.next}
                        </p>
                      ) : null}
                    </label>

                    <label className={styles.field}>
                      <span>Confirm New Password</span>
                      <input
                        type="password"
                        value={passwords.confirm}
                        onChange={(event) =>
                          updatePasswordField("confirm", event.target.value)
                        }
                        autoComplete="new-password"
                      />
                      {passwordErrors.confirm ? (
                        <p className={styles.fieldError}>
                          {passwordErrors.confirm}
                        </p>
                      ) : null}
                    </label>
                  </div>

                  {passwordStatus ? (
                    <p
                      className={
                        passwordStatus.type === "error"
                          ? `${styles.status} ${styles.statusError}`
                          : `${styles.status} ${styles.statusSuccess}`
                      }
                      role="status"
                    >
                      {passwordStatus.message}
                    </p>
                  ) : null}

                  <div className={styles.actions}>
                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={savingPassword}
                    >
                      {savingPassword ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </section>

              <section className={styles.panel}>
                <div className={styles.logoutRow}>
                  <div>
                    <h2 className={styles.sectionHeading}>Log Out</h2>
                    <p className={styles.panelHint}>
                      Sign out of Struktura on this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.outlineButton}
                    onClick={handleLogout}
                  >
                    Log Out
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "notifications" ? (
            <section className={styles.panel}>
              <h2 className={styles.sectionHeading}>Notifications</h2>
              <p className={styles.panelHint}>
                Choose what you want to be notified about.
              </p>

              <form onSubmit={saveNotifications}>
                {NOTIFICATION_OPTIONS.map((option) => (
                  <div className={styles.toggleRow} key={option.key}>
                    <span>{option.label}</span>
                    <ToggleSwitch
                      checked={notifications[option.key]}
                      label={option.label}
                      onChange={() => toggleNotification(option.key)}
                    />
                  </div>
                ))}

                {notificationStatus ? (
                  <p
                    className={
                      notificationStatus.type === "error"
                        ? `${styles.status} ${styles.statusError}`
                        : `${styles.status} ${styles.statusSuccess}`
                    }
                    role="status"
                  >
                    {notificationStatus.message}
                  </p>
                ) : null}

                <div className={styles.actions}>
                  <button type="submit" className={styles.primaryButton}>
                    Save Changes
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
