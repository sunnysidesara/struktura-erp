"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProjectSwitcher.module.css";

export type SwitcherItem = {
  id: number;
  title: string;
  code: string;
  meta: string;
};

/**
 * Header control shared by Project Managers ("My Projects") and Site
 * Supervisors ("My Sites"). Picking an entry drives the global project scope.
 */
export function ProjectSwitcher({
  label,
  items,
  selectedId,
  loading,
  error,
  emptyText,
  onSelect,
}: {
  label: string;
  items: SwitcherItem[];
  selectedId: number | null;
  loading: boolean;
  error: string;
  emptyText: string;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const triggerLabel = selected?.title ?? (loading ? "Loading..." : "Nothing selected");

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        <span className={styles.triggerLabel}>{label}</span>
        <span className={styles.triggerValue}>{triggerLabel}</span>
        <svg
          className={styles.chevron}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className={styles.panel} role="dialog" aria-label={label}>
          <div className={styles.panelHead}>
            <p className={styles.panelKicker}>{label}</p>
            <p className={styles.panelMeta}>
              {items.length} available
            </p>
          </div>

          {error !== "" ? <p className={styles.error}>{error}</p> : null}

          {!loading && items.length === 0 && error === "" ? (
            <p className={styles.empty}>{emptyText}</p>
          ) : null}

          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === selectedId ? styles.rowActive : styles.row}
                  onClick={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <span className={styles.rowTop}>
                    <strong>{item.title}</strong>
                    <span className={styles.code}>{item.code}</span>
                  </span>
                  <span className={styles.rowMeta}>{item.meta}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
