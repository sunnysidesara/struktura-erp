"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createSsLaborLog,
  deleteSsLaborLog,
  getSsLogHours,
  updateSsLaborLog,
  type SsLaborLog,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import {
  ErrorNote,
  Field,
  FormActions,
  FormShell,
  KpiStrip,
  SubmitButton,
} from "../_components/SsReport";
import { useSsResource } from "../_components/useSsResource";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import styles from "../../sa/page.module.css";
import ssStyles from "../ss.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

export function LaborTab({ projectId }: { projectId: number }) {
  const { data, loading, error, reload } = useSsResource(
    () => getSsLogHours(projectId),
    projectId,
  );

  const [assignmentId, setAssignmentId] = useState("");
  const [date, setDate] = useState("");
  const [regular, setRegular] = useState("8");
  const [overtime, setOvertime] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  useEffect(() => {
    if (data?.server_date && date === "" && editingId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(data.server_date);
    }
  }, [data?.server_date, date, editingId]);

  const assignments = data?.assignments ?? [];

  const resetForm = () => {
    setEditingId(null);
    setAssignmentId("");
    setRegular("8");
    setOvertime("0");
    setFormError("");
  };

  const startEdit = (row: SsLaborLog) => {
    setEditingId(row.log_id);
    setAssignmentId(String(row.assignment_id));
    setDate(String(row.date).slice(0, 10));
    setRegular(String(row.regular));
    setOvertime(String(row.overtime));
    setFormError("");
    setNotice(null);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice(null);

    const reg = Number(regular);
    const ot = Number(overtime);

    if (assignmentId === "") {
      setFormError("Select the worker this log belongs to.");
      return;
    }
    if (!Number.isFinite(reg) || reg < 0 || !Number.isFinite(ot) || ot < 0) {
      setFormError("Hours must be zero or more.");
      return;
    }
    if (reg + ot <= 0) {
      setFormError("Enter at least one hour.");
      return;
    }
    if (reg + ot > 24) {
      setFormError("A laborer cannot log more than 24 hours in one day.");
      return;
    }
    if (date === "") {
      setFormError("Choose the work date.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        assignment_id: Number(assignmentId),
        log_date: date,
        regular_hours: reg,
        overtime_hours: ot,
      };

      const result = editingId
        ? await updateSsLaborLog(editingId, body)
        : await createSsLaborLog(body);

      setNotice({ type: "success", message: result.message });
      resetForm();
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the labor log.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid(row: SsLaborLog) {
    const confirmed = window.confirm(
      `Void the labor entry for ${row.worker} on ${row.date}? The project budget is refunded and this cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteSsLaborLog(row.log_id);
      setNotice({ type: "success", message: result.message });

      if (editingId === row.log_id) {
        resetForm();
      }
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not void the log.",
      });
    }
  }

  const columns: SaColumn<SsLaborLog>[] = [
    {
      key: "date",
      label: "Date / Site",
      render: (row) => (
        <span>
          {row.date}
          <span style={{ display: "block", color: "#94a3b8", fontSize: "0.7rem" }}>{row.project}</span>
        </span>
      ),
    },
    { key: "worker", label: "Worker", render: (row) => row.worker },
    { key: "hours", label: "Hours", render: (row) => `${row.total} h` },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button type="button" className={styles.linkButton} onClick={() => setDetail({
            title: row.worker,
            rows: [
              { label: "Log ID", value: row.id },
              { label: "Date", value: row.date },
              { label: "Project", value: row.project },
              { label: "Phase", value: row.phase ?? "-" },
              { label: "Worker", value: row.worker },
              { label: "Regular Hours", value: `${row.regular} h` },
              { label: "Overtime Hours", value: `${row.overtime} h` },
              { label: "Total Hours", value: `${row.total} h` },
              { label: "Status", value: row.status },
            ],
          })}>
            View
          </button>
          <button type="button" className={styles.linkButton} onClick={() => startEdit(row)}>
            Edit
          </button>
          <button type="button" className={styles.linkButtonAlt} onClick={() => handleVoid(row)}>
            Void
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <SaPanel title={editingId ? `Correct labor log ${editingId}` : "New labor log"}>
        {notice ? (
          <p className={notice.type === "error" ? ssStyles.noticeError : ssStyles.notice}>
            {notice.message}
          </p>
        ) : null}

        {loading ? (
          <p className={ssStyles.muted}>Loading workers...</p>
        ) : assignments.length === 0 ? (
          <p className={ssStyles.muted}>No active worker assignments on this site yet.</p>
        ) : (
          <FormShell onSubmit={handleSubmit}>
            <Field label="Worker / Assignment">
              <select
                value={assignmentId}
                onChange={(event) => setAssignmentId(event.target.value)}
                required
              >
                <option value="">Select worker</option>
                {assignments.map((row) => (
                  <option key={row.assignment_id} value={row.assignment_id}>
                    {row.worker} - {row.phase ?? "Phase"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Work Date">
              <input
                type="date"
                value={date}
                max={data?.server_date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Regular Hours">
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={regular}
                onChange={(event) => setRegular(event.target.value)}
                required
              />
            </Field>
            <Field label="Overtime Hours">
              <input
                type="number"
                min="0"
                max="12"
                step="0.5"
                value={overtime}
                onChange={(event) => setOvertime(event.target.value)}
              />
            </Field>
            {formError !== "" ? <ErrorNote>{formError}</ErrorNote> : null}
            <FormActions>
              <SubmitButton>
                {saving ? "Saving..." : editingId ? "Save correction" : "Submit labor log"}
              </SubmitButton>
              {editingId ? (
                <button type="button" className={styles.linkButtonAlt} onClick={resetForm}>
                  Cancel edit
                </button>
              ) : null}
            </FormActions>
          </FormShell>
        )}
      </SaPanel>

      <KpiStrip
        items={[
          { label: "Hours Today", value: `${data?.metrics.hours_today ?? 0} h` },
          { label: "Logs Today", value: String(data?.metrics.logs_today ?? 0) },
          { label: "Crew On Site", value: String(data?.metrics.crew ?? 0) },
          { label: "Total Logs", value: String(data?.metrics.total_logs ?? 0) },
        ]}
      />

      <SaPanel title="Recent labor logs">
        <SaTable
          columns={columns}
          rows={data?.logs ?? []}
          loading={loading}
          error={error}
          rowKey={(row) => row.id}
          emptyText="No labor hours logged yet."
        />
      </SaPanel>

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Labor log details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </>
  );
}
