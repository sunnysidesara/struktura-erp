"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "./page.module.css";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password || !confirmPassword) {
      setError("Both password fields are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    localStorage.setItem("struktura_token", "mock-token");
    router.push("/portal/dashboard/sa");
  };

  return (
    <main className={styles.pageShell}>
      <div className={styles.card}>
        <h1 className={styles.title}>CHANGE PASSWORD</h1>
        <p className={styles.subtitle}>Set a new password to continue.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error ? <div className={styles.alert}>{error}</div> : null}

          <div className={styles.fieldGroup}>
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <button type="submit" className={styles.submitButton}>
            UPDATE PASSWORD
          </button>
        </form>
      </div>
    </main>
  );
}
