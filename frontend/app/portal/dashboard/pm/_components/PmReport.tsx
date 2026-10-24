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

export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.4rem", height: "170px", paddingTop: "0.5rem" }}>
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
  return <div className={styles.success}>{children}</div>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className={styles.alert}>{children}</div>;
}