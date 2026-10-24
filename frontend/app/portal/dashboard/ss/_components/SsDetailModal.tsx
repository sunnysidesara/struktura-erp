"use client";

import { useEffect, type ReactNode } from "react";
import type { SsSiteOption } from "@/lib/api";
import styles from "./SsDetailModal.module.css";

/**
 * Wide popup for the Site Supervisor console: "[Page] for: [Project]".
 */
export function SsDetailModal({
  page,
  site,
  children,
  onClose,
}: {
  page: string;
  site: SsSiteOption;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
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
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ss-detail-title">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Site Supervisor</p>
            <h2 className={styles.title} id="ss-detail-title">
              {page} for: {site.project}
            </h2>
            <p className={styles.meta}>
              {site.code}
              {site.location ? ` · ${site.location}` : ""}
              {site.status ? ` · ${site.status}` : ""}
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
