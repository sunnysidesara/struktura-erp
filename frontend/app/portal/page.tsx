"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import styles from "./page.module.css";

type UserRole = "SA" | "PM" | "SS";

type MockUser = {
  user_id: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  role_name: string;
  first_login: boolean;
};

const MOCK_USERS: MockUser[] = [
  {
    user_id: "SA101",
    password: "admin123",
    first_name: "Juan",
    last_name: "Dela Cruz",
    role: "SA",
    role_name: "System Administrator",
    first_login: false,
  },
  {
    user_id: "PM101",
    password: "pm123",
    first_name: "Maria",
    last_name: "Santos",
    role: "PM",
    role_name: "Project Manager",
    first_login: false,
  },
  {
    user_id: "SS101",
    password: "ss123",
    first_name: "Pedro",
    last_name: "Reyes",
    role: "SS",
    role_name: "Site Supervisor",
    first_login: false,
  },
];

const DASHBOARD_PATHS: Record<UserRole, string> = {
  SA: "/portal/dashboard/sa",
  PM: "/portal/dashboard/pm",
  SS: "/portal/dashboard/ss",
};

export default function PortalPage() {
  const router = useRouter();
  const userIdRef = useRef<HTMLInputElement | null>(null);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedUserId = userId.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUserId || !trimmedPassword) {
      setError("Please enter both User ID and Password.");
      userIdRef.current?.focus();
      return;
    }

    setLoading(true);

    // Simulate network delay while the auth request is processed.
    await new Promise((resolve) => setTimeout(resolve, 800));

    // TODO: Replace this mock check with a real API login call.
    const user = MOCK_USERS.find(
      (mockUser) =>
        mockUser.user_id.toUpperCase() === trimmedUserId.toUpperCase() &&
        mockUser.password === trimmedPassword,
    );

    if (!user) {
      setError("Invalid User ID or Password. Please try again.");
      setPassword("");
      setLoading(false);
      userIdRef.current?.focus();
      return;
    }

    localStorage.setItem("struktura_token", "mock-token-" + Date.now());
    localStorage.setItem(
      "struktura_user",
      JSON.stringify({
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        role_name: user.role_name,
      }),
    );

    const destination = user.first_login
      ? "/portal/change-password"
      : DASHBOARD_PATHS[user.role];

    setLoading(false);
    router.push(destination);
  };

  return (
    <>
      {/* Muted + playsInline keeps autoplay working under browser autoplay restrictions. */}
      <video
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        className={styles.bgVideo}
      >
        <source src="/assets/login-vid.mp4" type="video/mp4" />
      </video>
      <div className={styles.videoOverlay} aria-hidden="true" />
      <Link href="/" className={styles.backLink} aria-label="Back to landing page">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
        </svg>
      </Link>

      <main className={styles.pageWrapper}>
        <div className={styles.loginCard}>
          <div className={styles.logoWrap}>
            <Image
              src="/assets/struktura-banner.png"
              alt="Struktura logo"
              width={190}
              height={90}
              priority
              className={styles.logo}
              style={{ width: "280px", height: "auto" }}
            />
          </div>

          <h1 className={styles.heading}>PORTAL LOGIN</h1>
          <p className={styles.subtitle}>
            Sign in with your assigned credentials
          </p>

          {error ? (
            <div className={styles.errorBox} role="alert">
              {error}
            </div>
          ) : null}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="userId" className={styles.label}>
                USER ID
              </label>
              <input
                id="userId"
                ref={userIdRef}
                type="text"
                value={userId}
                onChange={(event) =>
                  setUserId(event.target.value.toUpperCase())
                }
                placeholder="e.g., SA101, PM101, SS101"
                autoComplete="username"
                autoFocus
                required
                className={styles.input}
                disabled={loading}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="password" className={styles.label}>
                PASSWORD
              </label>
              <div className={styles.passwordWrap}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className={styles.passwordInput}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.toggleButton}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.loginButton}
              aria-busy={loading}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.buttonContent}>
                  <span className={styles.spinner} aria-hidden="true" />
                  Signing in...
                </span>
              ) : (
                "LOG IN"
              )}
            </button>
          </form>

          <p className={styles.helperText}>
            Need access? Contact your system administrator.
          </p>
        </div>
      </main>
    </>
  );
}
