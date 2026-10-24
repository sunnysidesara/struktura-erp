"use client";

import { useEffect, useRef, useState } from "react";
import { selectSsSite, useSsSite } from "./siteSelection";
import styles from "./SsSiteSwitcher.module.css";

/**
 * Header control for the Site Supervisor: replaces the global search bar with
 * a "My Sites" dropdown. Picking a site swaps the data on every SS screen.
 */
export function SsSiteSwitcher() {
  const { sites, selected, loading, error } = useSsSite();
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

  const label = selected?.project ?? (loading ? "Loading sites..." : "Select a site");

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="My Sites"
      >
        <span className={styles.triggerLabel}>My Sites</span>
        <span className={styles.triggerValue}>{label}</span>
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
        <div className={styles.panel} role="dialog" aria-label="My Sites">
          <div className={styles.panelHead}>
            <p className={styles.panelKicker}>My Sites</p>
            <p className={styles.panelMeta}>
              {sites.length} assigned site{sites.length === 1 ? "" : "s"}
            </p>
          </div>

          {error !== "" ? <p className={styles.error}>{error}</p> : null}

          {!loading && sites.length === 0 && error === "" ? (
            <p className={styles.empty}>
              No site is assigned to this account yet. Ask your Project Manager to add you to a
              project.
            </p>
          ) : null}

          <ul className={styles.list}>
            {sites.map((site) => (
              <li key={site.project_id}>
                <button
                  type="button"
                  className={site.project_id === selected?.project_id ? styles.rowActive : styles.row}
                  onClick={() => {
                    selectSsSite(site.project_id);
                    setOpen(false);
                  }}
                >
                  <span className={styles.rowTop}>
                    <strong>{site.project}</strong>
                    <span className={styles.code}>{site.code}</span>
                  </span>
                  <span className={styles.rowMeta}>
                    {site.location ?? "-"} &middot; {site.progress}% complete
                    {site.status ? ` \u00b7 ${site.status}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
