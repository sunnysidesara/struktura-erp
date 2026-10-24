"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  clearSession,
  getMyLogins,
  logoutEverywhere,
  me,
  roleCodeFromName,
  type ApiLoginEntry,
  type RoleCode,
} from "@/lib/api";
import { describeDevice } from "@/lib/device";
import styles from "./page.module.css";

type ProfileData = {
  fullName: string;
  idNumber: string;
  email: string;
  contact: string | null;
  roleName: string;
  role: RoleCode | null;
  isActive: boolean;
  createdAt: string | null;
};

const ROLE_LABELS: Record<RoleCode, string> = {
  SA: "System Administrator",
  PM: "Project Manager",
  SS: "Site Supervisor",
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString("en-PH", DATE_FORMAT);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  const day = date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const time = date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${day} \u00b7 ${time}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [logins, setLogins] = useState<ApiLoginEntry[] | null>(null);
  const [loginsError, setLoginsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Everything on this page comes from the API: GET /me and GET /me/logins.
  useEffect(() => {
    let active = true;

    me()
      .then((user) => {
        if (!active) return;

        setProfile({
          fullName:
            user.full_name || `${user.first_name} ${user.last_name}`.trim(),
          idNumber: user.id_number,
          email: user.email,
          contact: user.contact_number,
          roleName: user.role?.role_name ?? "",
          role: roleCodeFromName(user.role?.role_name),
          isActive: user.is_active,
          createdAt: user.created_at ?? null,
        });
        setError("");
      })
      .catch(() => {
        if (active) {
          setError("We could not load your profile. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    getMyLogins()
      .then((entries) => {
        if (!active) return;

        setLogins(entries);
        setLoginsError(false);
      })
      .catch(() => {
        if (!active) return;

        setLogins([]);
        setLoginsError(true);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  const retry = () => {
    setLoading(true);
    setError("");
    setLoginsError(false);
    setReloadToken((current) => current + 1);
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);

    try {
      await logoutEverywhere();
    } catch {
      // Token may already be invalid; the local session is cleared regardless.
    }

    clearSession();
    router.replace("/portal");
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Loading profile...</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className={styles.page}>
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>My Profile</h1>
            <p className={styles.subtitle}>
              Your account information and recent activity
            </p>
          </div>
        </header>
        <section className={`${styles.card} ${styles.errorCard}`}>
          <p className={styles.signOutText}>
            {error || "We could not load your profile."}
          </p>
          <button type="button" className={styles.outlineButton} onClick={retry}>
            Try Again
          </button>
        </section>
      </main>
    );
  }

  const initials = `${profile.fullName[0] ?? ""}${
    profile.fullName.split(" ")[1]?.[0] ?? ""
  }`.toUpperCase();

  const roleLabel = profile.role
    ? ROLE_LABELS[profile.role]
    : profile.roleName || "Not assigned";

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.subtitle}>
            Your account information and recent activity
          </p>
        </div>
        <Link
          href="/portal/dashboard/settings"
          className={styles.outlineButton}
        >
          Edit Profile
        </Link>
      </header>

      <section className={styles.identityCard}>
        <div className={styles.avatar} aria-hidden="true">
          {initials}
        </div>
        <div className={styles.identityInfo}>
          <h2>{profile.fullName}</h2>
          <div className={styles.badgeRow}>
            <span className={styles.userId}>{profile.idNumber}</span>
            <span
              className={`${styles.roleBadge}${
                profile.role ? ` ${styles[`role${profile.role}`]}` : ""
              }`}
            >
              {roleLabel}
            </span>
          </div>
          <p>{profile.email}</p>
          <small>Member since {formatDate(profile.createdAt)}</small>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionHeading}>Account Details</h2>
        <dl className={styles.detailsGrid}>
          <div>
            <dt>Full Name</dt>
            <dd>{profile.fullName}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{profile.idNumber}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabel}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
          <div>
            <dt>Contact Number</dt>
            <dd>{profile.contact || "Not set"}</dd>
          </div>
          <div>
            <dt>Date Joined</dt>
            <dd>{formatDate(profile.createdAt)}</dd>
          </div>
          <div>
            <dt>Account Status</dt>
            <dd>
              <span
                className={
                  profile.isActive ? styles.statusActive : styles.statusInactive
                }
              >
                {profile.isActive ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <div className={styles.bottomGrid}>
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
                {loginsError ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={4}>
                      Could not load login activity.
                    </td>
                  </tr>
                ) : logins === null ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={4}>
                      Loading activity...
                    </td>
                  </tr>
                ) : logins.length === 0 ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={4}>
                      No recent activity
                    </td>
                  </tr>
                ) : (
                  logins.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.created_at)}</td>
                      <td>{entry.ip_address ?? "Not recorded"}</td>
                      <td>{describeDevice(entry.user_agent)}</td>
                      <td>
                        <span
                          className={
                            entry.status === "success"
                              ? styles.loginSuccess
                              : styles.loginFailed
                          }
                        >
                          {entry.status === "success" ? "Success" : "Failed"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.card} ${styles.signOutCard}`}>
          <div>
            <h2 className={styles.sectionHeading}>Sign Out</h2>
            <p className={styles.signOutText}>
              Ends this session and signs you out of every device.
            </p>
          </div>
          <button
            type="button"
            className={styles.dangerButton}
            onClick={signOutEverywhere}
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign Out Everywhere"}
          </button>
        </section>
      </div>
    </main>
  );
}
