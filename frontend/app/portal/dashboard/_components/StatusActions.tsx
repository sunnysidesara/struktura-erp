"use client";

import styles from "@/app/portal/dashboard/sa/page.module.css";

export type StatusAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

/**
 * Renders the allowed next-state actions for a status workflow. Status changes
 * must use these buttons, never a dropdown.
 */
export function StatusActions({ actions }: { actions: StatusAction[] }) {
  if (actions.length === 0) {
    return <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>No status actions</span>;
  }

  return (
    <div className={styles.actionCell}>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className={action.variant === "primary" ? styles.linkButton : styles.linkButtonAlt}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
