import Image from "next/image";
import SpinnerRing from "@/app/portal/_components/SpinnerRing";
import styles from "./AppBootScreen.module.css";

/**
 * First paint of the dashboard while the session is read from localStorage.
 * Mirrors the real shell so the frame never flashes white after login.
 */
export default function AppBootScreen() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Image
          src="/assets/banner-white.png?v=2"
          alt="Struktura"
          width={180}
          height={50}
          className={styles.logo}
          unoptimized
          priority
        />
      </header>
      <aside className={styles.sidebar} aria-hidden="true" />
      <main
        className={styles.main}
        role="status"
        aria-live="polite"
        aria-label="Loading your workspace"
      >
        <SpinnerRing />
      </main>
    </div>
  );
}