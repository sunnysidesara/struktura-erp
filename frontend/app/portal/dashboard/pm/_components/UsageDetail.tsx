"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SaPanel,
  SaTable,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import {
  createPmEquipmentUsage,
  createPmMaterialUsage,
  deletePmEquipmentUsage,
  deletePmMaterialUsage,
  listPmEquipmentCatalog,
  listPmEquipmentUsage,
  listPmMaterialCatalog,
  listPmMaterialUsage,
  listPmPhases,
  type PmCatalogEquipment,
  type PmCatalogMaterial,
  type PmPhase,
} from "@/lib/api";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type UsageRow = { id: number; name: string; amount: string; date: string; phase: string; phaseId: number };
type Notice = { type: "success" | "error"; message: string } | null;

/** Materials / Equipment detail popup: usage table + "log new usage" form. */
export function UsagePanel({
  projectId,
  kind,
}: {
  projectId: number;
  kind: "material" | "equipment";
}) {
  const isMaterial = kind === "material";
  const pageName = isMaterial ? "Materials" : "Equipment";

  const [rows, setRows] = useState<UsageRow[]>([]);
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [materials, setMaterials] = useState<PmCatalogMaterial[]>([]);
  const [machines, setMachines] = useState<PmCatalogEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);
  const [phaseFilter, setPhaseFilter] = useState("all");

  const [itemId, setItemId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);

    const usage = isMaterial
      ? listPmMaterialUsage(projectId).then((items) =>
          items.map((item) => ({
            id: item.usage_id,
            name: item.material,
            amount: `${item.quantity} ${item.unit ?? ""}`.trim(),
            date: item.date,
            phase: item.phase,
            phaseId: item.phase_id,
          })),
        )
      : listPmEquipmentUsage(projectId).then((items) =>
          items.map((item) => ({
            id: item.usage_id,
            name: item.equipment,
            amount: `${item.hours} h`,
            date: item.date,
            phase: item.phase,
            phaseId: item.phase_id,
          })),
        );

    Promise.all([
      usage,
      listPmPhases(projectId),
      isMaterial ? listPmMaterialCatalog() : listPmEquipmentCatalog(),
    ])
      .then(([usageRows, phaseList, catalog]) => {
        setRows(usageRows);
        setPhases(phaseList);

        if (isMaterial) {
          setMaterials(catalog as PmCatalogMaterial[]);
        } else {
          setMachines(catalog as PmCatalogEquipment[]);
        }
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : `Failed to load ${kind} data.`),
      )
      .finally(() => setLoading(false));
  }, [projectId, isMaterial, kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openForm = () => {
    const active = phases.find((phase) => phase.status === "In Progress") ?? phases[0];

    setItemId("");
    setPhaseId(active ? String(active.phase_id) : "");
    setDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setFormError("");
    setFormOpen(true);
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const value = Number(amount);

    if (!itemId) {
      setFormError(isMaterial ? "Select the material used." : "Select the equipment used.");
      return;
    }
    if (!phaseId) {
      setFormError("Select the phase this usage belongs to.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }

    setSaving(true);
    try {
      const result = isMaterial
        ? await createPmMaterialUsage({
            material_id: Number(itemId),
            phase_id: Number(phaseId),
            usage_date: date,
            quantity_used: value,
          })
        : await createPmEquipmentUsage({
            equipment_id: Number(itemId),
            phase_id: Number(phaseId),
            usage_date: date,
            hours_used: value,
          });

      setFormOpen(false);
      setNotice({ type: "success", message: result.message });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the entry.");
    } finally {
      setSaving(false);
    }
  }

  async function voidRow(row: UsageRow) {
    if (
      !window.confirm(
        `Void "${row.name}" for ${row.date}? The project budget${isMaterial ? " and stock" : ""} will be refunded.`,
      )
    ) {
      return;
    }

    try {
      const result = isMaterial
        ? await deletePmMaterialUsage(row.id)
        : await deletePmEquipmentUsage(row.id);

      setNotice({ type: "success", message: result.message });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not void the entry.",
      });
    }
  }

  const visibleRows = useMemo(
    () =>
      phaseFilter === "all"
        ? rows
        : rows.filter((row) => String(row.phaseId) === phaseFilter),
    [rows, phaseFilter],
  );

  const columns: SaColumn<UsageRow>[] = [
    { key: "name", label: isMaterial ? "Material" : "Equipment", render: (row) => row.name },
    { key: "amount", label: isMaterial ? "Quantity" : "Hours", render: (row) => row.amount },
    { key: "date", label: "Date", render: (row) => row.date },
    { key: "phase", label: "Phase", render: (row) => row.phase },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() =>
              setDetail({
                title: row.name,
                rows: [
                  { label: isMaterial ? "Material" : "Equipment", value: row.name },
                  { label: isMaterial ? "Quantity" : "Hours", value: row.amount },
                  { label: "Date", value: row.date },
                  { label: "Phase", value: row.phase },
                ],
              })
            }
          >
            View
          </button>
          <button type="button" className={styles.linkButtonAlt} onClick={() => voidRow(row)}>
            Void
          </button>
        </div>
      ),
    },
  ];

  const selectedMaterial = materials.find((item) => String(item.material_id) === itemId);
  const selectedMachine = machines.find((item) => String(item.equipment_id) === itemId);

  return (
    <>
      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel
        title={`${pageName} used (${visibleRows.length})`}
        filters={
          <>
            <span className={pmStyles.filterLabel}>Filter by Phase</span>
            <select
              value={phaseFilter}
              onChange={(event) => setPhaseFilter(event.target.value)}
              aria-label={`Filter ${pageName.toLowerCase()} by phase`}
            >
              <option value="all">All Phases</option>
              {phases.map((phase) => (
                <option key={phase.phase_id} value={phase.phase_id}>
                  {phase.sequence_no}. {phase.phase_name}
                </option>
              ))}
            </select>
            <button type="button" className={styles.primaryButton} onClick={openForm}>
              + Log {isMaterial ? "Material" : "Equipment"}
            </button>
          </>
        }
      >
        <SaTable
          columns={columns}
          rows={visibleRows}
          loading={loading}
          error={error}
          emptyText={
            phaseFilter === "all"
              ? `No ${kind} usage logged for this project yet.`
              : `No ${kind} usage logged for this phase yet.`
          }
          rowKey={(row) => row.id}
        />
      </SaPanel>

      <FormModal
        open={formOpen}
        kicker={pageName}
        title={`Log ${pageName.toLowerCase()}`}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        submitLabel="Save entry"
        saving={saving}
        error={formError}
      >
        <ModalField label={isMaterial ? "Material" : "Equipment"} htmlFor="usage-item">
          <select id="usage-item" value={itemId} onChange={(event) => setItemId(event.target.value)}>
            <option value="">{isMaterial ? "Select material" : "Select equipment"}</option>
            {isMaterial
              ? materials.map((item) => (
                  <option key={item.material_id} value={item.material_id}>
                    {item.material_name} ({item.stock_quantity} {item.unit_of_measure ?? "unit"} in stock)
                  </option>
                ))
              : machines.map((item) => (
                  <option key={item.equipment_id} value={item.equipment_id}>
                    {item.equipment_name} ({item.equipment_type ?? "unit"})
                  </option>
                ))}
          </select>
        </ModalField>

        <ModalGrid>
          <ModalField label="Phase" htmlFor="usage-phase">
            <select id="usage-phase" value={phaseId} onChange={(event) => setPhaseId(event.target.value)}>
              <option value="">Select phase</option>
              {phases.map((phase) => (
                <option key={phase.phase_id} value={phase.phase_id}>
                  {phase.sequence_no}. {phase.phase_name}
                </option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Date" htmlFor="usage-date">
            <input
              id="usage-date"
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setDate(event.target.value)}
            />
          </ModalField>
        </ModalGrid>

        <ModalField
          label={isMaterial ? "Quantity used" : "Hours used"}
          htmlFor="usage-amount"
          hint={
            isMaterial
              ? selectedMaterial
                ? `Stock on hand: ${selectedMaterial.stock_quantity} ${selectedMaterial.unit_of_measure ?? "unit"}`
                : "Select a material to see its stock."
              : selectedMachine
                ? `Machine status: ${selectedMachine.equipment_status ?? "Unknown"}`
                : "Select equipment to see its status."
          }
        >
          <input
            id="usage-amount"
            type="number"
            min="0.01"
            step="0.5"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={isMaterial ? "e.g. 12" : "e.g. 4"}
          />
        </ModalField>
      </FormModal>

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle={`${pageName} entry`}
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </>
  );
}
