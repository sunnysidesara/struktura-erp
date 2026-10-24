"use client";

import { useEffect, type ReactNode } from "react";
import styles from "./RecordDetails.module.css";

export type DetailRow = { label: string; value: ReactNode };

/**
 * Shared "View" drawer used by every table that needs more than 5 columns.
 * Palette is limited to navy / light blue / yellow gold.
 */
export function RecordDetails({
  open,
  title,
  subtitle,
  rows,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  rows: DetailRow[];
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

  if (!open) {
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
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="record-details-title">
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Details</p>
            <h2 className={styles.title} id="record-details-title">
              {title}
            </h2>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <dl className={styles.list}>
          {rows.map((row) => (
            <div className={styles.row} key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
