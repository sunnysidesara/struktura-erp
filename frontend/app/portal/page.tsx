"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  ApiError,
  ROLE_DASHBOARD_PATHS,
  login,
  saveSession,
  toSessionUser,
} from "@/lib/api";

export default function PortalPage() {
  const router = useRouter();
  const idNumberRef = useRef<HTMLInputElement | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedIdNumber = idNumber.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdNumber || !trimmedPassword) {
      setError("Please enter both User ID and Password.");
      idNumberRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const { token, user } = await login(trimmedIdNumber, trimmedPassword);
      const sessionUser = toSessionUser(user);

      if (!sessionUser) {
        setError(
          "Your account role is not recognized. Contact your administrator.",
        );
        setLoading(false);
        return;
      }

      saveSession(token, sessionUser);
      router.push(ROLE_DASHBOARD_PATHS[sessionUser.role]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to sign in. Please try again.",
      );
      setPassword("");
      setLoading(false);
      idNumberRef.current?.focus();
    }
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
              <label htmlFor="idNumber" className={styles.label}>
                USER ID
              </label>
              <input
                id="idNumber"
                ref={idNumberRef}
                type="text"
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value.toUpperCase())}
                placeholder="e.g., SYS010001"
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
