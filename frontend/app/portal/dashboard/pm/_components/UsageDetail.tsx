"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  createPmEquipmentUsage,
  createPmMaterialUsage,
  deletePmEquipmentUsage,
  deletePmMaterialUsage,
  listPmEquipmentCatalog,
  listPmEquipmentUsage,
  listPmMaterialCatalog,
  listPmMaterialUsage,
  listPmPhases,
  type PmPhase,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  money,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { FormModal, ModalField, ModalGrid } from "./FormModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

type UsageRow = {
  id: number;
  name: string;
  amount: string;
  date: string;
  phase: string;
  phaseId: number;
};

type CatalogOption = {
  id: number;
  name: string;
  detail: string;
  stock: number | null;
  unit: string | null;
  status: string | null;
};

/** Local calendar date for the date input's initial value and max. */
function todayInputValue(): string {
  const today = new Date();

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/**
 * Materials/equipment usage for the selected project. Project Managers can
 * log and void entries; Site Supervisors record their own usage in the SS logs.
 */
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
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const reload = () => setVersion((value) => value + 1);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    Promise.all([usage, listPmPhases(projectId)])
      .then(([usageRows, phaseList]) => {
        if (!active) return;
        setRows(usageRows);
        setPhases(phaseList);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : `Failed to load ${kind} data.`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId, isMaterial, kind, version]);

  const visibleRows = useMemo(
    () =>
      phaseFilter === "all"
        ? rows
        : rows.filter((row) => String(row.phaseId) === phaseFilter),
    [rows, phaseFilter],
  );

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setNotice({ type: "success", message });
    reload();
  };

  const handleDelete = async (row: UsageRow) => {
    const refund = isMaterial
      ? "Stock and the project budget will be refunded."
      : "The project budget will be refunded.";

    if (
      !window.confirm(
        `Void the ${kind} log for ${row.name} (${row.amount}) on ${row.phase}? ${refund}`,
      )
    ) {
      return;
    }

    setDeletingId(row.id);
    setNotice(null);

    try {
      const result = isMaterial
        ? await deletePmMaterialUsage(row.id)
        : await deletePmEquipmentUsage(row.id);

      setNotice({ type: "success", message: result.message });
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err instanceof Error ? err.message : `Could not delete the ${kind} usage.`,
      });
    } finally {
      setDeletingId(null);
    }
  };

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
            className={styles.linkButtonAlt}
            onClick={() => handleDelete(row)}
            disabled={deletingId !== null}
          >
            {deletingId === row.id ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

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
            <button
              type="button"
              className={pmStyles.assignButton}
              onClick={() => {
                setNotice(null);
                setModalOpen(true);
              }}
              disabled={loading || phases.length === 0}
            >
              Log Usage
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

      <UsageModal
        open={modalOpen}
        kind={kind}
        phases={phases}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}

function UsageModal({
  open,
  kind,
  phases,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: "material" | "equipment";
  phases: PmPhase[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isMaterial = kind === "material";
  const itemLabel = isMaterial ? "Material" : "Equipment";
  const amountLabel = isMaterial ? "Quantity" : "Hours";
  const today = todayInputValue();

  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [itemId, setItemId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [itemError, setItemError] = useState("");
  const [phaseError, setPhaseError] = useState("");
  const [dateError, setDateError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [formError, setFormError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setItemId("");
    setPhaseId("");
    setDate(todayInputValue());
    setAmount("");
    setItemError("");
    setPhaseError("");
    setDateError("");
    setAmountError("");
    setFormError("");
    setOptions([]);
    setCatalogLoading(true);
    setSaving(false);

    let active = true;
    const loader: Promise<CatalogOption[]> = isMaterial
      ? listPmMaterialCatalog().then((items) =>
          items.map(
            (item): CatalogOption => ({
              id: item.material_id,
              name: item.material_name,
              detail: `${money(item.unit_cost)} each · ${item.stock_quantity} ${item.unit_of_measure ?? "unit(s)"} in stock`,
              stock: item.stock_quantity,
              unit: item.unit_of_measure,
              status: null,
            }),
          ),
        )
      : listPmEquipmentCatalog().then((items) =>
          items.map(
            (item): CatalogOption => ({
              id: item.equipment_id,
              name: item.equipment_name,
              detail: `${money(item.hourly_rental_rate)}/hour · ${item.equipment_status ?? "Available"}`,
              stock: null,
              unit: null,
              status: item.equipment_status,
            }),
          ),
        );

    loader
      .then((values) => {
        if (active) setOptions(values);
      })
      .catch((err) => {
        if (active) {
          setFormError(
            err instanceof Error ? err.message : `Failed to load the ${kind} catalogue.`,
          );
        }
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, isMaterial, kind]);

  const selectedItem =
    options.find((option) => String(option.id) === itemId) ?? null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setItemError("");
    setPhaseError("");
    setDateError("");
    setAmountError("");
    setFormError("");

    if (!itemId || !selectedItem) {
      setItemError(`Select a ${itemLabel.toLowerCase()}.`);
      return;
    }

    if (!isMaterial && selectedItem.status === "Under Maintenance") {
      setItemError("This equipment is under maintenance and cannot be used.");
      return;
    }

    if (!phaseId) {
      setPhaseError("Select the phase this usage belongs to.");
      return;
    }

    if (!date) {
      setDateError("Choose the usage date.");
      return;
    }

    if (date > today) {
      setDateError("Usage date cannot be in the future.");
      return;
    }

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setAmountError(`Enter a ${amountLabel.toLowerCase()} greater than zero.`);
      return;
    }

    if (isMaterial && selectedItem.stock !== null && value > selectedItem.stock) {
      setAmountError(
        `Only ${selectedItem.stock} ${selectedItem.unit ?? "unit(s)"} remain in stock.`,
      );
      return;
    }

    if (!isMaterial && value > 24) {
      setAmountError("Equipment usage cannot exceed 24 hours per entry.");
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

      onSaved(result.message || `${itemLabel} usage logged.`);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const first = (key: string) => err.errors?.[key]?.[0];
        const itemMessage = first(isMaterial ? "material_id" : "equipment_id");
        const phaseMessage = first("phase_id");
        const dateMessage = first("usage_date");
        const amountMessage = first(
          isMaterial ? "quantity_used" : "hours_used",
        );

        if (itemMessage) {
          setItemError(itemMessage);
          return;
        }
        if (phaseMessage) {
          setPhaseError(phaseMessage);
          return;
        }
        if (dateMessage) {
          setDateError(dateMessage);
          return;
        }
        if (amountMessage) {
          setAmountError(amountMessage);
          return;
        }
      }

      setFormError(
        err instanceof Error ? err.message : `Could not log ${itemLabel.toLowerCase()} usage.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      kicker="Resources"
      title={`Log ${itemLabel} Usage`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Log Usage"
      saving={saving}
      error={formError}
    >
      <ModalField
        label={itemLabel}
        htmlFor="usage-item"
        error={itemError}
        hint={
          catalogLoading
            ? "Loading catalogue..."
            : selectedItem?.detail ??
              `Select a ${itemLabel.toLowerCase()} from the catalogue.`
        }
      >
        <select
          id="usage-item"
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          disabled={catalogLoading || options.length === 0}
        >
          <option value="">
            {catalogLoading
              ? "Loading..."
              : options.length === 0
                ? `No ${itemLabel.toLowerCase()} available`
                : `Select ${itemLabel.toLowerCase()}`}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </ModalField>

      <ModalGrid>
        <ModalField label="Phase" htmlFor="usage-phase" error={phaseError}>
          <select
            id="usage-phase"
            value={phaseId}
            onChange={(event) => setPhaseId(event.target.value)}
          >
            <option value="">Select a phase</option>
            {phases.map((phase) => (
              <option key={phase.phase_id} value={phase.phase_id}>
                {phase.sequence_no}. {phase.phase_name ?? `Phase ${phase.phase_id}`}
              </option>
            ))}
          </select>
        </ModalField>

        <ModalField label="Date" htmlFor="usage-date" error={dateError}>
          <input
            id="usage-date"
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </ModalField>
      </ModalGrid>

      <ModalField
        label={amountLabel}
        htmlFor="usage-amount"
        error={amountError}
        hint={
          isMaterial
            ? selectedItem
              ? `Available: ${selectedItem.stock ?? 0} ${selectedItem.unit ?? "unit(s)"}`
              : "Pick a material to see available stock."
            : "Up to 24 hours per entry."
        }
      >
        <input
          id="usage-amount"
          type="number"
          min="0.01"
          step="0.01"
          max={isMaterial ? (selectedItem?.stock ?? undefined) : 24}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
      </ModalField>
    </FormModal>
  );
}

