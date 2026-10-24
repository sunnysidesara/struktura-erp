"use client";

import { type ReactNode, useEffect, useState } from "react";
import styles from "../page.module.css";

export function SaPage({ kicker, title, subtitle, actions, children }: { kicker: string; title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.heroRow}>
          <div>
            <p className={styles.kicker}>{kicker}</p>
            <h1 className={styles.title}>{title}</h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export function SaPanel({ title, filters, children }: { title: string; filters?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <span>{title}</span>
        {filters ? <div className={styles.filterRow}>{filters}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Tab bar shared by section pages (Resources, Audit Logs). Purely client-side:
 * switching a tab never reloads the page.
 */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  label,
}: {
  items: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={active === item.id}
          className={
            active === item.id ? `${styles.tab} ${styles.tabActive}` : styles.tab
          }
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export type SaColumn<T> = { key: string; label: string; status?: boolean; sortable?: boolean; render: (row: T) => ReactNode };

/** Sort state for tables that opt into sortable headers. */
export type SaSortState = { key: string; direction: "asc" | "desc" } | null;

function nextSort(current: SaSortState | undefined, key: string): SaSortState {
  if (current?.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function SaTable<T>({ columns, rows, loading, error, emptyText, rowKey, sort, onSortChange }: { columns: SaColumn<T>[]; rows: T[]; loading?: boolean; error?: string; emptyText?: string; rowKey?: (row: T) => string | number; sort?: SaSortState; onSortChange?: (next: SaSortState) => void }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) =>
              column.sortable && onSortChange ? (
                <th key={column.key} className={column.status ? styles.statusColumn : undefined} aria-sort={sort?.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className={styles.sortButton} onClick={() => onSortChange(nextSort(sort, column.key))}>
                    {column.label}
                    <span aria-hidden="true">{sort?.key === column.key ? (sort.direction === "asc" ? "\u25B2" : "\u25BC") : "\u2195"}</span>
                  </button>
                </th>
              ) : (
                <th key={column.key} className={column.status ? styles.statusColumn : undefined}>{column.label}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length}>Loading...</td></tr>
          ) : error ? (
            <tr><td colSpan={columns.length}>{error}</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length}>{emptyText ?? "No records found."}</td></tr>
          ) : (
            rows.map((row, index) => (
              <tr key={rowKey ? rowKey(row) : index}>
                {columns.map((column) => (
                  <td key={column.key} className={column.status ? styles.statusColumn : undefined}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status ?? "-";
  const normalized = value.toLowerCase();
  const className =
    normalized === "insert"
      ? styles.statusInsert
      : normalized === "update"
        ? styles.statusUpdate
        : normalized === "delete"
          ? styles.statusDelete
          : normalized === "success"
            ? styles.statusActive
            : normalized === "failed"
              ? styles.statusInactive
              : normalized.includes("active") || normalized.includes("complete") || normalized.includes("available") || normalized.includes("on track")
                ? styles.statusActive
                : normalized.includes("inactive") || normalized.includes("terminated")
                  ? styles.statusInactive
                  : normalized.includes("maintenance") || normalized.includes("delayed") || normalized.includes("progress") || normalized.includes("pending") || normalized.includes("not started")
                    ? styles.statusWarning
                    : styles.statusCompleted;

  return <span className={className}>{value}</span>;
}

export function MetricCard({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <article className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      {note ? <small className={styles.metricNote}>{note}</small> : null}
    </article>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <section className={styles.metricGrid}>{children}</section>;
}

export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "-";
  return "\u20B1 " + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function useApiData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    loader()
      .then((value) => { if (active) { setData(value); setError(""); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load data."); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error };
}