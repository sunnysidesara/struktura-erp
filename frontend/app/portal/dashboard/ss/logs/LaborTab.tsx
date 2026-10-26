"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createSsLaborLog,
  deleteSsLaborLog,
  getSsLogHours,
  getSsPhases,
  updateSsLaborLog,
  type SsLaborLog,
} from "@/lib/api";
import { confirmDelete } from "@/lib/confirmDelete";
import { SaPanel, SaTable, Tabs, type SaColumn } from "@/app/portal/dashboard/sa/_components/SaPage";
import {
  ErrorNote,
  Field,
  FormActions,
  FormShell,
  SubmitButton,
} from "../_components/SsReport";
import { useSsResource } from "../_components/useSsResource";
import styles from "../../sa/page.module.css";
import ssStyles from "../ss.module.css";

type Notice = { type: "success" | "error"; message: string } | null;
type TabId = "add" | "history";

const TABS: { id: TabId; label: string }[] = [
  { id: "history", label: "All Workers Log" },
  { id: "add", label: "Add Log for Today" },
];
const SHIFTS = ["Morning", "Afternoon"] as const;

export function LaborTab({ projectId }: { projectId: number }) {
  const { data, loading, error, reload } = useSsResource(
    () => getSsLogHours(projectId),
    projectId,
  );
  // Phase dropdown is fed live from the phases endpoint.
  const phaseResource = useSsResource(() => getSsPhases(projectId), projectId);

  // History is the default view; adding a log is always one click away.
  const [tab, setTab] = useState<TabId>("history");

  const [dateFilter, setDateFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");

  const [assignmentId, setAssignmentId] = useState("");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState<string>("Morning");
  const [timeIn, setTimeIn] = useState("08:00");
  const [timeOut, setTimeOut] = useState("17:00");
  const [formPhase, setFormPhase] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [editingLog, setEditingLog] = useState<SsLaborLog | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (data?.server_date && date === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(data.server_date);
    }
  }, [data?.server_date, date]);

  useEffect(() => {
    if (data?.server_date && dateFilter === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDateFilter(data.server_date);
    }
  }, [data?.server_date, dateFilter]);

  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);
  const sitePhases = useMemo(
    () => phaseResource.data?.data ?? [],
    [phaseResource.data],
  );

  // Workers on the chosen phase (all active workers when no phase is picked).
  const workerOptions = useMemo(() => {
    const options =
      formPhase === ""
        ? assignments
        : assignments.filter((row) => String(row.phase_id) === formPhase);

    // Keep a historical assignment selectable even after it has been released.
    if (
      editingLog &&
      !options.some((row) => row.assignment_id === editingLog.assignment_id)
    ) {
      return [
        {
          assignment_id: editingLog.assignment_id,
          laborer_id: 0,
          worker: editingLog.worker,
          phase_id: editingLog.phase_id,
          phase: editingLog.phase,
          role_on_task: null,
          status: "Active",
        },
        ...options,
      ];
    }

    return options;
  }, [assignments, editingLog, formPhase]);

  const selectedAssignment =
    workerOptions.find((row) => String(row.assignment_id) === assignmentId) ?? null;
  const workerId =
    selectedAssignment && selectedAssignment.laborer_id > 0
      ? `LAB-${String(selectedAssignment.laborer_id).padStart(4, "0")}`
      : "";

  // Date + shift + phase are applied together in the history table.
  const visible = useMemo(
    () =>
      (data?.logs ?? []).filter((row) => {
        const matchesDate = dateFilter === "" || String(row.date).slice(0, 10) === dateFilter;
        const matchesShift = shiftFilter === "all" || row.shift === shiftFilter;
        const matchesPhase = phaseFilter === "all" || String(row.phase_id) === phaseFilter;

        return matchesDate && matchesShift && matchesPhase;
      }),
    [data?.logs, dateFilter, shiftFilter, phaseFilter],
  );

  function resetForm() {
    setAssignmentId("");
    setFormPhase("");
    setShift("Morning");
    setTimeIn("08:00");
    setTimeOut("17:00");
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice(null);

    if (assignmentId === "") {
      setFormError("Select the worker this log belongs to.");
      return;
    }
    if (date === "") {
      setFormError("Choose the work date.");
      return;
    }
    if (timeIn === "" || timeOut === "") {
      setFormError("Enter both the time in and the time out.");
      return;
    }
    if (timeOut <= timeIn) {
      setFormError("Time out must be later than time in.");
      return;
    }

    setSaving(true);
    const wasEditing = editingLog !== null;

    try {
      const body = {
        assignment_id: Number(assignmentId),
        log_date: date,
        shift,
        time_in: timeIn,
        time_out: timeOut,
      };
      const result = wasEditing
        ? await updateSsLaborLog(editingLog.log_id, {
            ...body,
            overtime_hours: editingLog.overtime,
          })
        : await createSsLaborLog(body);

      setNotice({ type: "success", message: result.message });
      setEditingLog(null);
      resetForm();
      reload();
      setTab("history");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the labor log.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: SsLaborLog) {
    setEditingLog(row);
    setAssignmentId(String(row.assignment_id));
    setFormPhase(String(row.phase_id));
    setDate(String(row.date).slice(0, 10));
    setShift(row.shift);
    setTimeIn((row.time_in ?? "08:00").slice(0, 5));
    setTimeOut((row.time_out ?? "17:00").slice(0, 5));
    setFormError("");
    setNotice(null);
    setTab("add");
  }

  function cancelEdit() {
    setEditingLog(null);
    resetForm();
    setTab("history");
  }

  async function handleDelete(row: SsLaborLog) {
    if (
      !confirmDelete(
        `Void the labor log for ${row.worker} on ${row.date}? The project budget will be refunded.`,
      )
    ) {
      return;
    }

    setDeletingId(row.log_id);
    setNotice(null);

    try {
      const result = await deleteSsLaborLog(row.log_id);
      setNotice({ type: "success", message: result.message });
      if (editingLog?.log_id === row.log_id) {
        setEditingLog(null);
        resetForm();
      }
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not delete the labor log.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  // Five read-only columns plus row actions.
  const columns: SaColumn<SsLaborLog>[] = [
    { key: "worker", label: "Worker Name", render: (row) => row.worker },
    { key: "phase", label: "Phase", render: (row) => row.phase ?? "-" },
    { key: "shift", label: "Shift", render: (row) => row.shift },
    {
      key: "times",
      label: "Time In / Out",
      render: (row) => `${row.time_in ?? "-"} - ${row.time_out ?? "-"}`,
    },
    { key: "hours", label: "Total Hours", render: (row) => `${row.total} h` },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button type="button" className={styles.linkButton} onClick={() => startEdit(row)}>
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => handleDelete(row)}
            disabled={deletingId !== null}
          >
            {deletingId === row.log_id ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Tabs items={TABS} active={tab} onChange={setTab} label="Workers log views" />

      {notice ? (
        <p className={notice.type === "error" ? ssStyles.noticeError : ssStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      {tab === "add" ? (
        <SaPanel title={editingLog ? "Edit worker log" : "Add log for today"}>
          {!editingLog && assignments.length === 0 && !loading ? (
            <p className={ssStyles.notice}>
              No active worker is assigned to this site yet. Ask your Project Manager to assign a
              worker to a phase, then the dropdown below will populate.
            </p>
          ) : null}

          <FormShell onSubmit={handleSubmit}>
            <Field label="Worker Name">
              <select
                value={assignmentId}
                onChange={(event) => {
                  const value = event.target.value;
                  setAssignmentId(value);
                  const match = assignments.find((row) => String(row.assignment_id) === value);
                  if (match?.phase_id) {
                    setFormPhase(String(match.phase_id));
                  }
                }}
                disabled={workerOptions.length === 0}
                required
              >
                <option value="">
                  {loading ? "Loading workers..." : "Select worker"}
                </option>
                {workerOptions.map((row) => (
                  <option key={row.assignment_id} value={row.assignment_id}>
                    {row.worker} - {row.phase ?? "Phase"}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Worker ID">
              <input type="text" value={workerId} readOnly placeholder="Auto-filled" />
            </Field>

            <Field label="Date">
              <input
                type="date"
                value={date}
                max={data?.server_date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </Field>

            <Field label="Shift">
              <select value={shift} onChange={(event) => setShift(event.target.value)} required>
                {SHIFTS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Time In">
              <input
                type="time"
                value={timeIn}
                onChange={(event) => setTimeIn(event.target.value)}
                required
              />
            </Field>

            <Field label="Time Out">
              <input
                type="time"
                value={timeOut}
                onChange={(event) => setTimeOut(event.target.value)}
                required
              />
            </Field>

            <Field label="Skill / Phase">
              <select
                value={formPhase}
                onChange={(event) => {
                  setFormPhase(event.target.value);
                  setAssignmentId("");
                }}
              >
                <option value="">All phases</option>
                {editingLog &&
                !sitePhases.some((phase) => phase.phase_id === editingLog.phase_id) ? (
                  <option value={editingLog.phase_id}>
                    {editingLog.phase ?? `Phase ${editingLog.phase_id}`}
                  </option>
                ) : null}
                {sitePhases.map((phase) => (
                  <option key={phase.phase_id} value={phase.phase_id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </Field>

            {formError !== "" ? <ErrorNote>{formError}</ErrorNote> : null}
            <FormActions>
              {editingLog ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel edit
                </button>
              ) : null}
              <SubmitButton>
                {saving ? "Saving..." : editingLog ? "Update Log" : "Save Log"}
              </SubmitButton>
            </FormActions>
          </FormShell>
        </SaPanel>
      ) : null}


      {tab === "history" ? (
        <SaPanel
          title={`Worker logs (${visible.length})`}
          filters={
            <>
              <span className={ssStyles.siteSelectLabel}>Date</span>
              <input
                type="date"
                value={dateFilter}
                max={data?.server_date}
                onChange={(event) => setDateFilter(event.target.value)}
                aria-label="Filter worker logs by date"
              />
              <span className={ssStyles.siteSelectLabel}>Filter by Shift</span>
              <select
                value={shiftFilter}
                onChange={(event) => setShiftFilter(event.target.value)}
                aria-label="Filter worker logs by shift"
              >
                <option value="all">All Shifts</option>
                {SHIFTS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span className={ssStyles.siteSelectLabel}>Filter by Phase</span>
              <select
                value={phaseFilter}
                onChange={(event) => setPhaseFilter(event.target.value)}
                aria-label="Filter worker logs by phase"
              >
                <option value="all">All Phases</option>
                {sitePhases.map((phase) => (
                  <option key={phase.phase_id} value={phase.phase_id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </>
          }
        >
          <SaTable
            columns={columns}
            rows={visible}
            loading={loading}
            error={error}
            rowKey={(row) => row.id}
            emptyText="No worker logs match this date, shift and phase."
          />
        </SaPanel>
      ) : null}
    </>
  );
}

