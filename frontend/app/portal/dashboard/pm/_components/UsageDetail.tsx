"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listPmEquipmentUsage,
  listPmMaterialUsage,
  listPmPhases,
  type PmPhase,
} from "@/lib/api";
import { SaPanel, SaTable, type SaColumn } from "@/app/portal/dashboard/sa/_components/SaPage";
import pmStyles from "../page.module.css";

type UsageRow = {
  id: number;
  name: string;
  amount: string;
  date: string;
  phase: string;
  phaseId: number;
};

/**
 * Read-only materials/equipment usage for the selected project. Only a Site
 * Supervisor may log usage, so there is no form or row action here.
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
  }, [projectId, isMaterial, kind]);

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
  ];

  return (
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
  );
}
