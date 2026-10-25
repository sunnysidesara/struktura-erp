"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createSsMaterialUsage, deleteSsMaterialUsage, getSsMaterials, updateSsMaterialUsage, type SsMaterialLog } from "@/lib/api";
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

export function MaterialsTab({ projectId }: { projectId: number }) {
  const { data, loading, error, reload } = useSsResource(
    () => getSsMaterials(projectId),
    projectId,
  );

  const [tab, setTab] = useState<TabId>("usage");
  const [dateFilter, setDateFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");

  const [materialId, setMaterialId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [editingLog, setEditingLog] = useState<SsMaterialLog | null>(null);
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

  const materials = data?.materials ?? [];
  const phases = data?.phases ?? [];
  const selected = materials.find((row) => String(row.material_id) === materialId);

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
    if (data?.server_date && date > data.server_date) {
      setFormError("Usage date cannot be in the future.");
      return;
    }
    if (editingLog === null && selected && qty > selected.stock) {
      setFormError(
        `Only ${selected.stock} ${selected.unit ?? "unit(s)"} of ${selected.name} remain in stock.`,
      );
      return;
    }

    setSaving(true);
    const wasEditing = editingLog !== null;

    try {
      const body = {
        material_id: Number(materialId),
        phase_id: Number(phaseId),
        usage_date: date,
        quantity_used: qty,
      };
      const result = wasEditing
        ? await updateSsMaterialUsage(editingLog.usage_id, body)
        : await createSsMaterialUsage(body);

      setNotice({ type: "success", message: result.message });
      setEditingLog(null);
      setQuantity("");
      reload();
      if (wasEditing) setTab("usage");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the material usage.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: SsMaterialLog) {
    setEditingLog(row);
    setMaterialId(String(row.material_id));
    setPhaseId(String(row.phase_id));
    setDate(String(row.date).slice(0, 10));
    setQuantity(String(row.quantity));
    setFormError("");
    setNotice(null);
    setTab("log");
  }

  function cancelEdit() {
    setEditingLog(null);
    setQuantity("");
    setFormError("");
    setTab("usage");
  }

  async function handleDelete(row: SsMaterialLog) {
    if (
      !window.confirm(
        `Void the material log for ${row.material} on ${row.date}? Stock and the project budget will be refunded.`,
      )
    ) {
      return;
    }

    setDeletingId(row.usage_id);
    setNotice(null);

    try {
      const result = await deleteSsMaterialUsage(row.usage_id);
      setNotice({ type: "success", message: result.message });
      if (editingLog?.usage_id === row.usage_id) {
        setEditingLog(null);
        setQuantity("");
      }
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not delete the material usage.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  // Five read-only columns plus row actions.
  const columns: SaColumn<SsMaterialLog>[] = [
    { key: "date", label: "Date", render: (row) => row.date },
    { key: "material", label: "Material", render: (row) => row.material },
    {
      key: "quantity",
      label: "Quantity",
      render: (row) => `${row.quantity} ${row.unit ?? ""}`.trim(),
    },
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

      <Tabs items={TABS} active={tab} onChange={setTab} label="Materials log views" />

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
                aria-label="Filter material usage by date"
              />
              <span className={ssStyles.siteSelectLabel}>Filter by Phase</span>
              <select
                value={phaseFilter}
                onChange={(event) => setPhaseFilter(event.target.value)}
                aria-label="Filter material usage by phase"
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
            emptyText="No material usage matches this date and phase."
          />
        </SaPanel>
      ) : (
        <SaPanel title={editingLog ? "Edit material usage" : "Log today's material usage"}>
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
                  step="any"
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
                      : "Record material usage"}
                </SubmitButton>
              </FormActions>
            </FormShell>
          )}
        </SaPanel>
      )}
    </>
  );
}

