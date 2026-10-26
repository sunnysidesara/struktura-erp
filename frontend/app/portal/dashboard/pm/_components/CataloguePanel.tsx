"use client";

import {
  listPmEquipmentCatalog,
  listPmMaterialCatalog,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  money,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";

type CatalogueRow = {
  id: number;
  name: string;
  unit: string;
  cost: number;
  stock: number;
  type: string;
  status: string | null;
};

const materialColumns: SaColumn<CatalogueRow>[] = [
  { key: "name", label: "Material", render: (row) => row.name },
  { key: "unit", label: "Unit", render: (row) => row.unit },
  { key: "cost", label: "Unit Cost", render: (row) => money(row.cost) },
  { key: "stock", label: "Stock", render: (row) => String(row.stock) },
];

const equipmentColumns: SaColumn<CatalogueRow>[] = [
  { key: "name", label: "Equipment", render: (row) => row.name },
  { key: "type", label: "Type", render: (row) => row.type },
  { key: "cost", label: "Hourly Rate", render: (row) => money(row.cost) },
  {
    key: "status",
    label: "Status",
    status: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
];

/** Read-only material or equipment catalogue for the PM console. */
export function CataloguePanel({ kind }: { kind: "material" | "equipment" }) {
  const isMaterial = kind === "material";

  const { data, loading, error } = useApiData<CatalogueRow[]>(() =>
    isMaterial
      ? listPmMaterialCatalog().then((items) =>
          items.map(
            (item): CatalogueRow => ({
              id: item.material_id,
              name: item.material_name,
              unit: item.unit_of_measure ?? "-",
              cost: item.unit_cost,
              stock: item.stock_quantity,
              type: "-",
              status: null,
            }),
          ),
        )
      : listPmEquipmentCatalog().then((items) =>
          items.map(
            (item): CatalogueRow => ({
              id: item.equipment_id,
              name: item.equipment_name,
              unit: "-",
              cost: item.hourly_rental_rate,
              stock: 0,
              type: item.equipment_type ?? "-",
              status: item.equipment_status,
            }),
          ),
        ),
  );

  const rows = data ?? [];

  return (
    <SaPanel
      title={`${isMaterial ? "Material" : "Equipment"} Catalogue (${rows.length})`}
    >
      <SaTable
        columns={isMaterial ? materialColumns : equipmentColumns}
        rows={rows}
        loading={loading}
        error={error}
        emptyText={
          isMaterial
            ? "No materials are recorded in the catalogue yet."
            : "No equipment is recorded in the catalogue yet."
        }
        rowKey={(row) => row.id}
      />
    </SaPanel>
  );
}
