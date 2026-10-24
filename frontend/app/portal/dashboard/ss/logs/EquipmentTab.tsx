"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createSsEquipmentUsage,
  deleteSsEquipmentUsage,
  getSsEquipment,
  updateSsEquipmentUsage,
  type SsEquipmentLog,
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

export function EquipmentTab({ projectId }: { projectId: number }) {
  const { data, loading, error, reload } = useSsResource(
    () => getSsEquipment(projectId),
    projectId,
  );

  const [equipmentId, setEquipmentId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
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

  useEffect(() => {
    if (!data || phaseId !== "" || editingId !== null) return;
    const active = data.phases.find((phase) => phase.status === "In Progress") ?? data.phases[0];
    if (active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhaseId(String(active.phase_id));
    }
  }, [data, phaseId, editingId]);

  const machines = data?.equipment ?? [];
  const phases = data?.phases ?? [];
  const selected = machines.find((row) => String(row.equipment_id) === equipmentId);

  const resetForm = () => {
    setEditingId(null);
    setEquipmentId("");
    setHours("");
    setFormError("");
  };

  const startEdit = (row: SsEquipmentLog) => {
    setEditingId(row.usage_id);
    setEquipmentId(String(row.equipment_id));
    setPhaseId(String(row.phase_id));
    setDate(String(row.date).slice(0, 10));
    setHours(String(row.hours));
    setFormError("");
    setNotice(null);
  };

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
      setFormError("Operating hours must be greater than zero.");
      return;
    }
    if (value > 24) {
      setFormError("Equipment cannot run more than 24 hours in one day.");
      return;
    }
    if (date === "") {
      setFormError("Choose the usage date.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        equipment_id: Number(equipmentId),
        phase_id: Number(phaseId),
        usage_date: date,
        hours_used: value,
      };

      const result = editingId
        ? await updateSsEquipmentUsage(editingId, body)
        : await createSsEquipmentUsage(body);

      setNotice({ type: "success", message: result.message });
      resetForm();
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the equipment usage.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid(row: SsEquipmentLog) {
    const confirmed = window.confirm(
      `Void the ${row.equipment} entry for ${row.date}? The project budget is refunded.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteSsEquipmentUsage(row.usage_id);
      setNotice({ type: "success", message: result.message });

      if (editingId === row.usage_id) {
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

  const columns: SaColumn<SsEquipmentLog>[] = [
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
    { key: "equipment", label: "Equipment", render: (row) => row.equipment },
    { key: "hours", label: "Hours", render: (row) => `${row.hours} h` },
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
            title: row.equipment,
            rows: [
              { label: "Log ID", value: row.id },
              { label: "Date", value: row.date },
              { label: "Project", value: row.project },
              { label: "Phase", value: row.phase ?? "-" },
              { label: "Equipment", value: row.equipment },
              { label: "Hours Used", value: `${row.hours} h` },
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
      <SaPanel title={editingId ? `Correct equipment entry ${editingId}` : "New equipment usage"}>
        {notice ? (
          <p className={notice.type === "error" ? ssStyles.noticeError : ssStyles.notice}>
            {notice.message}
          </p>
        ) : null}

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
                    {row.name} ({row.type ?? "unit"}) - {row.status ?? "Unknown"}
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
            <Field label="Operating Hours">
              <input
                type="number"
                min="0.01"
                max="24"
                step="0.5"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                required
              />
            </Field>
            {selected ? (
              <p className={ssStyles.muted}>
                Machine status: {selected.status ?? "Unknown"}
              </p>
            ) : null}
            {formError !== "" ? <ErrorNote>{formError}</ErrorNote> : null}
            <FormActions>
              <SubmitButton>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save correction"
                    : "Record equipment usage"}
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
          { label: "Machines Today", value: String(data?.metrics.machines_today ?? 0) },
          { label: "Total Logs", value: String(data?.metrics.total_logs ?? 0) },
        ]}
      />

      <SaPanel title="Recent equipment usage">
        <SaTable
          columns={columns}
          rows={data?.logs ?? []}
          loading={loading}
          error={error}
          rowKey={(row) => row.id}
          emptyText="No equipment usage recorded yet."
        />
      </SaPanel>

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Equipment log details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </>
  );
}
