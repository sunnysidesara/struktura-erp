"use client";

import { useState } from "react";
import {
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

type TabId = "equipment" | "materials" | "suppliers";

const TABS: { id: TabId; label: string }[] = [
  { id: "equipment", label: "Equipment" },
  { id: "materials", label: "Materials" },
  { id: "suppliers", label: "Suppliers" },
];

export default function ResourcesPage() {
  const [tab, setTab] = useState<TabId>("equipment");
  const { data, loading, error } = useApiData(getAdminResources);

  const equipment = data?.equipment ?? [];
  const materials = data?.materials ?? [];
  const suppliers = data?.suppliers ?? [];

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
  ];

  const materialColumns: SaColumn<ApiMaterial>[] = [
    { key: "name", label: "Material", render: (row) => row.material_name },
    { key: "unit", label: "Unit", render: (row) => row.unit_of_measure ?? "-" },
    { key: "cost", label: "Unit Cost", render: (row) => money(row.unit_cost) },
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
    >
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
    </SaPage>
  );
}
