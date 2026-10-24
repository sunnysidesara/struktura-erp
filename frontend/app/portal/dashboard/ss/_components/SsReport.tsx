"use client";

import { type FormEvent, type ReactNode } from "react";
import styles from "../../sa/page.module.css";

export function ReportFilters({ children }: { children: ReactNode }) {
  return (
    <div className={styles.filterRow} style={{ paddingBottom: "1rem" }}>
      {children}
    </div>
  );
}

export function KpiStrip({ items }: { items: { label: string; value: string; tone?: "default" | "positive" | "negative" }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, gap: "1rem", padding: "1.25rem 0", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
      {items.map((item) => (
        <div key={item.label} style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>{item.label}</div>
          <div style={{ marginTop: "0.4rem", fontSize: "1.35rem", fontWeight: 800, color: item.tone === "negative" ? "#a16207" : "#0a1440" }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: "160px", paddingTop: "0.5rem" }}>
        {data.map((item, index) => (
          <div key={item.label} title={`${item.label}: ${item.value}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
            <span style={{ display: "block", height: `${Math.max(6, (item.value / max) * 100)}%`, background: index % 2 === 0 ? "#1e3a8a" : "#ca8a04", borderRadius: "4px 4px 0 0" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.35rem", fontSize: "0.65rem", color: "#64748b" }}>
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function FormShell({ children, onSubmit }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className={styles.form} onSubmit={onSubmit}>{children}</form>;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className={styles.formActions}>{children}</div>;
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return <div className={styles.success} style={{ margin: 0 }}>{children}</div>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className={styles.alert} style={{ margin: 0 }}>{children}</div>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
        <span style={{ display: "block", width: `${Math.min(100, Math.max(0, value))}%`, height: "100%", background: value >= 100 ? "#1e3a8a" : "#ca8a04" }} />
      </div>
      <span style={{ fontSize: "0.72rem", color: "#0f172a" }}>{value}%</span>
    </div>
  );
}
export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className={styles.primaryButton}>
      {children}
    </button>
  );
}
