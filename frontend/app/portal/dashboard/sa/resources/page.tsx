"use client";

import { useState } from "react";
import {
  changeEquipmentStatus,
  deleteEquipment,
  deleteMaterial,
  getAdminResources,
  type ApiEquipment,
  type ApiMaterial,
  type ApiSupplier,
} from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  Tabs,
  money,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../page.module.css";
import { CatalogueModal } from "./CatalogueModal";
import { StatusActions, type StatusAction } from "../../_components/StatusActions";

type TabId = "equipment" | "materials" | "suppliers";
type Editor =
  | { kind: "material"; item: ApiMaterial | null }
  | { kind: "equipment"; item: ApiEquipment | null }
  | null;
type Notice = { type: "success" | "error"; message: string } | null;

const TABS: { id: TabId; label: string }[] = [
  { id: "equipment", label: "Equipment" },
  { id: "materials", label: "Materials" },
  { id: "suppliers", label: "Suppliers" },
];

export default function ResourcesPage() {
  const [tab, setTab] = useState<TabId>("equipment");
  const [editor, setEditor] = useState<Editor>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const { data, loading, error, reload } = useApiData(getAdminResources);

  const equipment = data?.equipment ?? [];
  const materials = data?.materials ?? [];
  const suppliers = data?.suppliers ?? [];

  const handleSaved = (message: string) => {
    setEditor(null);
    setNotice({ type: "success", message });
    reload();
  };

  const handleDelete = async (
    kind: "equipment" | "material",
    row: ApiEquipment | ApiMaterial,
  ) => {
    const name =
      kind === "equipment"
        ? (row as ApiEquipment).equipment_name
        : (row as ApiMaterial).material_name;

    if (!window.confirm(`Delete ${kind} "${name}"?`)) {
      return;
    }

    const id =
      kind === "equipment"
        ? (row as ApiEquipment).equipment_id
        : (row as ApiMaterial).material_id;
    setDeletingId(`${kind}-${id}`);
    setNotice(null);

    try {
      const result =
        kind === "equipment"
          ? await deleteEquipment(id)
          : await deleteMaterial(id);

      setNotice({ type: "success", message: result.message });
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not delete the record.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const openCreate = () => {
    if (tab === "suppliers") return;
    setEditor({ kind: tab === "materials" ? "material" : "equipment", item: null });
  };

  const equipmentStatusActions = (row: ApiEquipment): StatusAction[] => {
    const run = (status: string) => () => handleEquipmentStatus(row, status);

    if (row.equipment_status === "Available") {
      return [
        { label: "Mark In Use", onClick: run("In Use"), variant: "primary" },
        { label: "Send to Maintenance", onClick: run("Under Maintenance") },
      ];
    }

    if (row.equipment_status === "In Use") {
      return [
        { label: "Mark Available", onClick: run("Available"), variant: "primary" },
        { label: "Send to Maintenance", onClick: run("Under Maintenance") },
      ];
    }

    if (row.equipment_status === "Under Maintenance") {
      return [{ label: "Mark Available", onClick: run("Available"), variant: "primary" }];
    }

    return [];
  };

  const handleEquipmentStatus = async (row: ApiEquipment, status: string) => {
    setStatusBusyId(row.equipment_id);
    setNotice(null);

    try {
      const result = await changeEquipmentStatus(row.equipment_id, status);
      setNotice({ type: "success", message: result.message });
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not change the equipment status.",
      });
    } finally {
      setStatusBusyId(null);
    }
  };

  const equipmentColumns: SaColumn<ApiEquipment>[] = [
    { key: "name", label: "Equipment", render: (row) => row.equipment_name },
    { key: "type", label: "Type", render: (row) => row.equipment_type ?? "-" },
    { key: "rate", label: "Hourly Rate", render: (row) => money(row.hourly_rental_rate) },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.equipment_status} />,
    },
    {
      key: "statusActions",
      label: "Status Actions",
      render: (row) => (
        <StatusActions
          actions={equipmentStatusActions(row).map((action) => ({
            ...action,
            disabled: statusBusyId !== null,
          }))}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setEditor({ kind: "equipment", item: row })}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => handleDelete("equipment", row)}
            disabled={deletingId !== null}
          >
            {deletingId === `equipment-${row.equipment_id}` ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  const materialColumns: SaColumn<ApiMaterial>[] = [
    { key: "name", label: "Material", render: (row) => row.material_name },
    { key: "unit", label: "Unit", render: (row) => row.unit_of_measure ?? "-" },
    { key: "cost", label: "Unit Cost", render: (row) => money(row.unit_cost) },
    { key: "stock", label: "Stock", render: (row) => String(row.stock_quantity) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setEditor({ kind: "material", item: row })}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => handleDelete("material", row)}
            disabled={deletingId !== null}
          >
            {deletingId === `material-${row.material_id}` ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  const supplierColumns: SaColumn<ApiSupplier>[] = [
    { key: "name", label: "Supplier", render: (row) => row.supplier_name },
    {
      key: "contact",
      label: "Contact",
      render: (row) =>
        [row.contact_name, row.contact_num].filter(Boolean).join(" - ") || "-",
    },
    {
      key: "location",
      label: "Location",
      render: (row) =>
        [row.city, row.state_province, row.country].filter(Boolean).join(", "),
    },
  ];

  return (
    <SaPage
      kicker="Operations"
      title="Resources"
      subtitle="Equipment, materials and suppliers"
      actions={
        tab === "suppliers" ? undefined : (
          <button type="button" className={styles.primaryButton} onClick={openCreate}>
            + New {tab === "materials" ? "Material" : "Equipment"}
          </button>
        )
      }
    >
      {notice ? (
        <p className={notice.type === "error" ? styles.alert : styles.success}>
          {notice.message}
        </p>
      ) : null}

      <Tabs
        items={TABS}
        active={tab}
        onChange={setTab}
        label="Resource categories"
      />

      {tab === "equipment" ? (
        <SaPanel title={`Equipment (${equipment.length})`}>
          <SaTable
            columns={equipmentColumns}
            rows={equipment}
            loading={loading}
            error={error}
            emptyText="No equipment recorded."
            rowKey={(row) => row.equipment_id}
          />
        </SaPanel>
      ) : null}

      {tab === "materials" ? (
        <SaPanel title={`Materials (${materials.length})`}>
          <SaTable
            columns={materialColumns}
            rows={materials}
            loading={loading}
            error={error}
            emptyText="No materials recorded."
            rowKey={(row) => row.material_id}
          />
        </SaPanel>
      ) : null}

      {tab === "suppliers" ? (
        <SaPanel title={`Suppliers (${suppliers.length})`}>
          <SaTable
            columns={supplierColumns}
            rows={suppliers}
            loading={loading}
            error={error}
            emptyText="No suppliers recorded."
            rowKey={(row) => row.supplier_id}
          />
        </SaPanel>
      ) : null}

      <CatalogueModal
        open={editor !== null}
        kind={editor?.kind ?? "material"}
        item={editor?.item ?? null}
        onClose={() => setEditor(null)}
        onSaved={handleSaved}
      />
    </SaPage>
  );
}
