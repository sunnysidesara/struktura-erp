"use client";

import { Fragment, useState } from "react";
import {
  getAuditEvents,
  getAuditLogins,
  type ApiAuditEvent,
  type ApiLoginAttempt,
} from "@/lib/api";
import { describeDevice } from "@/lib/device";
import {
  SaPage,
  SaPanel,
  StatusBadge,
  Tabs,
  formatDate,
  useApiData,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "./page.module.css";

type TabId = "events" | "logins";

const TABS: { id: TabId; label: string }[] = [
  { id: "events", label: "System Events" },
  { id: "logins", label: "Login History" },
];

/** Normalise a stored JSON payload into a flat key/value record. */
function toRecord(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined || value === "") {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);

      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** "remaining_budget" -> "Remaining Budget" */
function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "\u2014";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return Array.isArray(value)
      ? value.map(displayValue).join(", ")
      : JSON.stringify(value);
  }

  return String(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  return displayValue(left) === displayValue(right);
}

function actorLabel(row: ApiAuditEvent): string {
  if (!row.id_number) {
    return "System";
  }

  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();

  return name ? `${row.id_number} \u2014 ${name}` : row.id_number;
}

function accountLabel(row: ApiLoginAttempt): string {
  if (!row.id_number) {
    return "Unknown account";
  }

  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();

  return name ? `${row.id_number} \u2014 ${name}` : row.id_number;
}

/** Readable before/after table — never raw JSON. */
function ChangeDetails({
  action,
  oldValue,
  newValue,
}: {
  action: string;
  oldValue: unknown;
  newValue: unknown;
}) {
  const before = toRecord(oldValue);
  const after = toRecord(newValue);
  const fields = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  );

  const isUpdate = action.toLowerCase() === "update";
  const isDelete = action.toLowerCase() === "delete";

  if (fields.length === 0) {
    return (
      <p className={styles.detailEmpty}>
        No field values were captured for this change.
      </p>
    );
  }

  return (
    <table className={styles.diffTable}>
      <thead>
        <tr>
          <th>Field</th>
          {isUpdate ? (
            <>
              <th>Before</th>
              <th>After</th>
            </>
          ) : (
            <th>{isDelete ? "Deleted value" : "New value"}</th>
          )}
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => {
          const changed = isUpdate && !sameValue(before[field], after[field]);

          return (
            <tr key={field}>
              <td
                className={
                  changed
                    ? `${styles.fieldName} ${styles.changedRowCell}`
                    : styles.fieldName
                }
              >
                {humanize(field)}
              </td>
              {isUpdate ? (
                <>
                  <td className={changed ? styles.changedRowCell : undefined}>
                    {displayValue(before[field])}
                  </td>
                  <td className={changed ? styles.changedRowCell : undefined}>
                    {displayValue(after[field])}
                  </td>
                </>
              ) : (
                <td>{displayValue(isDelete ? before[field] : after[field])}</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function AuditLogsPage() {
  const [tab, setTab] = useState<TabId>("events");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const events = useApiData(getAuditEvents);
  const logins = useApiData(getAuditLogins);

  const eventRows = events.data ?? [];
  const loginRows = logins.data ?? [];

  const toggle = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <SaPage
      kicker="Audit Logs"
      title="Audit Logs"
      subtitle="System events and sign-in history, recorded live"
    >
      <Tabs
        items={TABS}
        active={tab}
        onChange={(id) => {
          setTab(id);
          setExpandedId(null);
        }}
        label="Audit views"
      />

      {tab === "events" ? (
        <SaPanel title="System Events">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Table Name</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.loading ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={5}>
                      Loading system events...
                    </td>
                  </tr>
                ) : events.error ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={5}>
                      {events.error}
                    </td>
                  </tr>
                ) : eventRows.length === 0 ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={5}>
                      No audit events recorded yet. Create or edit a user, skill,
                      project or phase and it will appear here.
                    </td>
                  </tr>
                ) : (
                  eventRows.map((row) => (
                    <Fragment key={row.audit_log_id}>
                      <tr>
                        <td>{formatDate(row.charge_at)}</td>
                        <td>{actorLabel(row)}</td>
                        <td className={styles.center}>
                          <StatusBadge status={row.action_type} />
                        </td>
                        <td>{row.table_name}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.expandButton}
                            onClick={() => toggle(row.audit_log_id)}
                            aria-expanded={expandedId === row.audit_log_id}
                          >
                            {expandedId === row.audit_log_id
                              ? "Hide Details"
                              : "View Details"}
                          </button>
                        </td>
                      </tr>

                      {expandedId === row.audit_log_id ? (
                        <tr>
                          <td className={styles.detailRowCell} colSpan={5}>
                            <span className={styles.detailMeta}>
                              {row.table_name} #{row.record_id}
                              {row.project_name ? ` \u00b7 ${row.project_name}` : ""}
                            </span>
                            <ChangeDetails
                              action={row.action_type}
                              oldValue={row.old_value}
                              newValue={row.new_value}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SaPanel>
      ) : (
        <SaPanel title="Login History">
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>User</th>
                  <th>IP Address</th>
                  <th>Device</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logins.loading ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={5}>
                      Loading sign-in attempts...
                    </td>
                  </tr>
                ) : logins.error ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={5}>
                      {logins.error}
                    </td>
                  </tr>
                ) : loginRows.length === 0 ? (
                  <tr>
                    <td className={styles.emptyCell} colSpan={5}>
                      No sign-in attempts recorded yet.
                    </td>
                  </tr>
                ) : (
                  loginRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{accountLabel(row)}</td>
                      <td>{row.ip_address ?? "Not recorded"}</td>
                      <td>{describeDevice(row.user_agent)}</td>
                      <td className={styles.center}>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SaPanel>
      )}
    </SaPage>
  );
}

