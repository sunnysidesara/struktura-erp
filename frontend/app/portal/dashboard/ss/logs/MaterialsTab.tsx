"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createSsMaterialUsage,
  deleteSsMaterialUsage,
  getSsMaterials,
  updateSsMaterialUsage,
  type SsMaterialLog,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  money,
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

export function MaterialsTab({ projectId }: { projectId: number }) {
  const { data, loading, error, reload } = useSsResource(
    () => getSsMaterials(projectId),
    projectId,
  );

  const [materialId, setMaterialId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("");
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

  const materials = data?.materials ?? [];
  const phases = data?.phases ?? [];
  const selected = materials.find((row) => String(row.material_id) === materialId);

  const resetForm = () => {
    setEditingId(null);
    setMaterialId("");
    setQuantity("");
    setFormError("");
  };

  const startEdit = (row: SsMaterialLog) => {
    setEditingId(row.usage_id);
    setMaterialId(String(row.material_id));
    setPhaseId(String(row.phase_id));
    setDate(String(row.date).slice(0, 10));
    setQuantity(String(row.quantity));
    setFormError("");
    setNotice(null);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice(null);

    const qty = Number(quantity);

    if (materialId === "") {
      setFormError("Select the material that was used.");
      return;
    }
    if (phaseId === "") {
      setFormError("Select the phase this material was used on.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("Quantity must be greater than zero.");
      return;
    }
    if (date === "") {
      setFormError("Choose the usage date.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        material_id: Number(materialId),
        phase_id: Number(phaseId),
        usage_date: date,
        quantity_used: qty,
      };

      const result = editingId
        ? await updateSsMaterialUsage(editingId, body)
        : await createSsMaterialUsage(body);

      setNotice({ type: "success", message: result.message });
      resetForm();
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the material usage.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVoid(row: SsMaterialLog) {
    const confirmed = window.confirm(
      `Void the ${row.material} entry for ${row.date}? The stock and project budget are refunded.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await deleteSsMaterialUsage(row.usage_id);
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

  const columns: SaColumn<SsMaterialLog>[] = [
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
    { key: "material", label: "Material", render: (row) => row.material },
    {
      key: "quantity",
      label: "Quantity",
      render: (row) => `${row.quantity} ${row.unit ?? ""}`.trim(),
    },
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
            title: row.material,
            rows: [
              { label: "Log ID", value: row.id },
              { label: "Date", value: row.date },
              { label: "Project", value: row.project },
              { label: "Phase", value: row.phase ?? "-" },
              { label: "Material", value: row.material },
              { label: "Quantity", value: `${row.quantity} ${row.unit ?? ""}`.trim() },
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
      <KpiStrip
        items={[
          {
            label: "Total Materials Allocation",
            value: money(data?.metrics.materials_allocation ?? 0),
          },
          {
            label: "Total Materials Expenses",
            value: money(data?.metrics.materials_spent ?? 0),
            tone: "negative",
          },
          {
            label: "Remaining Materials Budget",
            value: money(data?.metrics.materials_remaining ?? 0),
            tone: (data?.metrics.materials_remaining ?? 0) < 0 ? "negative" : "positive",
          },
        ]}
      />

      <SaPanel title={editingId ? `Correct material entry ${editingId}` : "New material usage"}>
        {notice ? (
          <p className={notice.type === "error" ? ssStyles.noticeError : ssStyles.notice}>
            {notice.message}
          </p>
        ) : null}

        {loading ? (
          <p className={ssStyles.muted}>Loading materials...</p>
        ) : phases.length === 0 ? (
          <p className={ssStyles.muted}>No phases are defined for this site yet.</p>
        ) : (
          <FormShell onSubmit={handleSubmit}>
            <Field label="Material">
              <select
                value={materialId}
                onChange={(event) => setMaterialId(event.target.value)}
                required
              >
                <option value="">Select material</option>
                {materials.map((row) => (
                  <option key={row.material_id} value={row.material_id}>
                    {row.name} ({row.unit ?? "unit"})
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
            <Field label="Quantity">
              <input
                type="number"
                min="0.01"
                step="0.5"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </Field>
            <Field label="Unit">
              <input type="text" value={selected?.unit ?? ""} readOnly />
            </Field>
            {selected ? (
              <p className={ssStyles.muted}>
                Stock on hand: {selected.stock} {selected.unit ?? "unit"}
              </p>
            ) : null}
            {formError !== "" ? <ErrorNote>{formError}</ErrorNote> : null}
            <FormActions>
              <SubmitButton>
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save correction"
                    : "Record material usage"}
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

      <SaPanel title="Recent material usage">
        <SaTable
          columns={columns}
          rows={data?.logs ?? []}
          loading={loading}
          error={error}
          rowKey={(row) => row.id}
          emptyText="No material usage recorded yet."
        />
      </SaPanel>

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Material log details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </>
  );
}
