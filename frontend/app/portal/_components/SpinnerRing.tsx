import styles from "./SpinnerRing.module.css";

/**
 * The single loading ring used by every loading state (login, boot, data).
 */
export default function SpinnerRing({ className }: { className?: string }) {
  return (
    <span
      className={className ? `${styles.ring} ${className}` : styles.ring}
      aria-hidden="true"
    >
      <svg viewBox="0 0 50 50" className={styles.svg}>
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="6"
          strokeDasharray="104 22"
          strokeLinecap="butt"
        />
      </svg>
    </span>
  );
}