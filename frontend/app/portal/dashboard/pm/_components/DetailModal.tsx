"use client";

import { useEffect, type ReactNode } from "react";
import styles from "./DetailModal.module.css";

type ProjectHeader = {
  project_name: string;
  code: string;
  status?: string | null;
  location?: string | null;
};

/**
 * Wide master-detail popup: "[Page] for: [Project] (PRJ-XXXX)".
 */
export function DetailModal({
  open,
  page,
  project,
  children,
  onClose,
}: {
  open: boolean;
  page: string;
  project: ProjectHeader | null;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !project) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="pm-detail-title">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Project Manager</p>
            <h2 className={styles.title} id="pm-detail-title">
              {page} for: {project.project_name} ({project.code})
            </h2>
            <p className={styles.meta}>
              {project.status ?? "-"}
              {project.location ? ` · ${project.location}` : ""}
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
