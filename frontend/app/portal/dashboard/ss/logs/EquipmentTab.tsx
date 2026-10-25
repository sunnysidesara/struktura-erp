"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createSsEquipmentUsage, deleteSsEquipmentUsage, getSsEquipment, updateSsEquipmentUsage, type SsEquipmentLog } from "@/lib/api";
import { SaPanel, SaTable, Tabs, money, type SaColumn } from "@/app/portal/dashboard/sa/_components/SaPage";
import {
  ErrorNote,
  Field,
  FormActions,
  FormShell,
  KpiStrip,
  SubmitButton,
} from "../_components/SsReport";
import { useSsResource } from "../_components/useSsResource";
import styles from "../../sa/page.module.css";
import ssStyles from "../ss.module.css";

type Notice = { type: "success" | "error"; message: string } | null;
type TabId = "usage" | "log";

const TABS: { id: TabId; label: string }[] = [
  { id: "usage", label: "All Usage" },
  { id: "log", label: "Log Today's Usage" },
];

export function EquipmentTab({ projectId }: { projectId: number }) {
  const { data, loading, error, reload } = useSsResource(
    () => getSsEquipment(projectId),
    projectId,
  );

  const [tab, setTab] = useState<TabId>("usage");
  const [dateFilter, setDateFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");

  const [equipmentId, setEquipmentId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [editingLog, setEditingLog] = useState<SsEquipmentLog | null>(null);
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

  useEffect(() => {
    if (!data || phaseId !== "") return;
    const active = data.phases.find((phase) => phase.status === "In Progress") ?? data.phases[0];
    if (active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhaseId(String(active.phase_id));
    }
  }, [data, phaseId]);

  const machines = data?.equipment ?? [];
  const phases = data?.phases ?? [];
  const selected = machines.find((row) => String(row.equipment_id) === equipmentId);

  // Date + phase filters apply together.
  const visibleRows = useMemo(
    () =>
      (data?.logs ?? []).filter((row) => {
        const matchesDate = dateFilter === "" || String(row.date).slice(0, 10) === dateFilter;
        const matchesPhase = phaseFilter === "all" || String(row.phase_id) === phaseFilter;

        return matchesDate && matchesPhase;
      }),
    [data?.logs, dateFilter, phaseFilter],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice(null);

    const value = Number(hours);

    if (equipmentId === "") {
      setFormError("Select the equipment that was used.");
      return;
    }
    if (phaseId === "") {
      setFormError("Select the phase this equipment was used on.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Hours must be greater than zero.");
      return;
    }
    if (date === "") {
      setFormError("Choose the usage date.");
      return;
    }
    if (data?.server_date && date > data.server_date) {
      setFormError("Usage date cannot be in the future.");
      return;
    }
    if (value > 24) {
      setFormError("Equipment usage cannot exceed 24 hours per entry.");
      return;
    }
    if (selected?.status === "Under Maintenance") {
      setFormError("This equipment is under maintenance and cannot be used.");
      return;
    }

    setSaving(true);
    const wasEditing = editingLog !== null;

    try {
      const body = {
        equipment_id: Number(equipmentId),
        phase_id: Number(phaseId),
        usage_date: date,
        hours_used: value,
      };
      const result = wasEditing
        ? await updateSsEquipmentUsage(editingLog.usage_id, body)
        : await createSsEquipmentUsage(body);

      setNotice({ type: "success", message: result.message });
      setEditingLog(null);
      setHours("");
      reload();
      if (wasEditing) setTab("usage");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the equipment usage.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: SsEquipmentLog) {
    setEditingLog(row);
    setEquipmentId(String(row.equipment_id));
    setPhaseId(String(row.phase_id));
    setDate(String(row.date).slice(0, 10));
    setHours(String(row.hours));
    setFormError("");
    setNotice(null);
    setTab("log");
  }

  function cancelEdit() {
    setEditingLog(null);
    setHours("");
    setFormError("");
    setTab("usage");
  }

  async function handleDelete(row: SsEquipmentLog) {
    if (
      !window.confirm(
        `Void the equipment log for ${row.equipment} on ${row.date}? The project budget will be refunded.`,
      )
    ) {
      return;
    }

    setDeletingId(row.usage_id);
    setNotice(null);

    try {
      const result = await deleteSsEquipmentUsage(row.usage_id);
      setNotice({ type: "success", message: result.message });
      if (editingLog?.usage_id === row.usage_id) {
        setEditingLog(null);
        setHours("");
      }
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not delete the equipment usage.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  // Five read-only columns plus row actions.
  const columns: SaColumn<SsEquipmentLog>[] = [
    { key: "date", label: "Date", render: (row) => row.date },
    { key: "equipment", label: "Equipment", render: (row) => row.equipment },
    { key: "hours", label: "Hours", render: (row) => `${row.hours} h` },
    { key: "phase", label: "Phase", render: (row) => row.phase ?? "-" },
    { key: "expense", label: "Expense", render: (row) => money(row.expense) },
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
            {deletingId === row.usage_id ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <KpiStrip
        items={[
          {
            label: "Total Equipment Allocation",
            value: money(data?.metrics.equipment_allocation ?? 0),
          },
          {
            label: "Total Equipment Expenses",
            value: money(data?.metrics.equipment_spent ?? 0),
            tone: "negative",
          },
          {
            label: "Remaining Equipment Budget",
            value: money(data?.metrics.equipment_remaining ?? 0),
            tone: (data?.metrics.equipment_remaining ?? 0) < 0 ? "negative" : "positive",
          },
        ]}
      />

      <Tabs items={TABS} active={tab} onChange={setTab} label="Equipment log views" />

      {notice ? (
        <p className={notice.type === "error" ? ssStyles.noticeError : ssStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      {tab === "usage" ? (
        <SaPanel
          title={`All usage (${visibleRows.length})`}
          filters={
            <>
              <span className={ssStyles.siteSelectLabel}>Date</span>
              <input
                type="date"
                value={dateFilter}
                max={data?.server_date}
                onChange={(event) => setDateFilter(event.target.value)}
                aria-label="Filter equipment usage by date"
              />
              <span className={ssStyles.siteSelectLabel}>Filter by Phase</span>
              <select
                value={phaseFilter}
                onChange={(event) => setPhaseFilter(event.target.value)}
                aria-label="Filter equipment usage by phase"
              >
                <option value="all">All Phases</option>
                {phases.map((phase) => (
                  <option key={phase.phase_id} value={phase.phase_id}>
                    {phase.sequence}. {phase.name}
                  </option>
                ))}
              </select>
            </>
          }
        >
          <SaTable
            columns={columns}
            rows={visibleRows}
            loading={loading}
            error={error}
            rowKey={(row) => row.id}
            emptyText="No equipment usage matches this date and phase."
          />
        </SaPanel>
      ) : (
        <SaPanel title={editingLog ? "Edit equipment usage" : "Log today's equipment usage"}>
          {loading ? (
            <p className={ssStyles.muted}>Loading equipment...</p>
          ) : phases.length === 0 ? (
            <p className={ssStyles.muted}>No phases are defined for this site yet.</p>
          ) : (
            <FormShell onSubmit={handleSubmit}>
              <Field label="Equipment">
                <select
                  value={equipmentId}
                  onChange={(event) => setEquipmentId(event.target.value)}
                  required
                >
                  <option value="">Select equipment</option>
                  {machines.map((row) => (
                    <option key={row.equipment_id} value={row.equipment_id}>
                      {row.name} ({row.type ?? "unit"})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Phase">
                <select
                  value={phaseId}
                  onChange={(event) => setPhaseId(event.target.value)}
                  required
                >
                  <option value="">Select phase</option>
                  {phases.map((phase) => (
                    <option key={phase.phase_id} value={phase.phase_id}>
                      {phase.sequence}. {phase.name} ({phase.status ?? "-"})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Usage Date">
                <input
                  type="date"
                  value={date}
                  max={data?.server_date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </Field>
              <Field label="Hours">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  required
                />
              </Field>
              {selected ? (
                <p className={ssStyles.muted}>Machine status: {selected.status ?? "Unknown"}</p>
              ) : null}
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
                  {saving
                    ? "Saving..."
                    : editingLog
                      ? "Update usage"
                      : "Record equipment usage"}
                </SubmitButton>
              </FormActions>
            </FormShell>
          )}
        </SaPanel>
      )}
    </>
  );
}

