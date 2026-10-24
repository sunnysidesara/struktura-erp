import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.kicker}>Error 404</p>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.message}>
          The page you are looking for does not exist or has been moved. Check
          the address, or head back to the portal.
        </p>
        <div className={styles.actions}>
          <Link href="/portal" className={styles.primaryLink}>
            Back to Portal
          </Link>
          <Link href="/" className={styles.secondaryLink}>
            Go to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
