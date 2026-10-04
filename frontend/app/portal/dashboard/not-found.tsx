import Link from "next/link";
import styles from "./not-found.module.css";

export default function DashboardNotFound() {
  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>Dashboard</p>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.message}>
        This dashboard section is not available yet.
      </p>
      <Link href="/portal" className={styles.link}>
        Return to the portal
      </Link>
    </main>
  );
}
