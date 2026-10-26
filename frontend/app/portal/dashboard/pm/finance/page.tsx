"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listPmBudgets,
  listPmPhaseCosts,
  type PmBudget,
  type PmPhaseCost,
} from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  money,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { PmProjectGate } from "../_components/PmProjectGate";
import { usePmProject } from "../_components/projectSelection";
import pmStyles from "../page.module.css";
import styles from "../../sa/page.module.css";

export default function FinancePage() {
  const { selected } = usePmProject();

  return (
    <SaPage
      kicker="Finance"
      title="Finance"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project_name}`
          : "Select a project to review its budget and costs."
      }
    >
      <PmProjectGate>{(projectId) => <FinancePanel projectId={projectId} />}</PmProjectGate>
    </SaPage>
  );
}

const costColumns: SaColumn<PmPhaseCost>[] = [
  { key: "phase", label: "Phase Name", render: (row) => row.phase ?? "-" },
  { key: "labor", label: "Labor Cost", render: (row) => money(row.labor) },
  { key: "materials", label: "Material Cost", render: (row) => money(row.materials) },
  { key: "equipment", label: "Equipment Cost", render: (row) => money(row.equipment) },
  { key: "total", label: "Total", render: (row) => <strong>{money(row.total)}</strong> },
];

/** Single-page finance view: resource breakdown and per-phase cost reports. */
function FinancePanel({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [budget, setBudget] = useState<PmBudget | null>(null);
  const [phaseCosts, setPhaseCosts] = useState<PmPhaseCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([
      listPmBudgets(projectId),
      listPmPhaseCosts(projectId),
    ])
      .then(([budgets, costs]) => {
        if (!active) return;
        setBudget(budgets[0] ?? null);
        setPhaseCosts(costs);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load finance data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <>
      {error !== "" ? <p className={pmStyles.noticeError}>{error}</p> : null}

      <SaPanel title="Breakdown">
        <div className={pmStyles.breakdownList}>
          <div className={pmStyles.breakdownRow}>
            <div className={pmStyles.breakdownInfo}>
              <p className={pmStyles.breakdownTitle}>Materials</p>
              <p className={pmStyles.breakdownMeta}>
                Expenses {money(budget?.materials_spent ?? 0)} &middot; Remaining{" "}
                {money(budget?.materials_remaining ?? 0)}
              </p>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => router.push("/portal/dashboard/pm/materials")}
            >
              Show Breakdown
            </button>
          </div>

          <div className={pmStyles.breakdownRow}>
            <div className={pmStyles.breakdownInfo}>
              <p className={pmStyles.breakdownTitle}>Equipment</p>
              <p className={pmStyles.breakdownMeta}>
                Expenses {money(budget?.equipment_spent ?? 0)} &middot; Remaining{" "}
                {money(budget?.equipment_remaining ?? 0)}
              </p>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => router.push("/portal/dashboard/pm/equipment")}
            >
              Show Breakdown
            </button>
          </div>
        </div>
      </SaPanel>

      <SaPanel title={`Cost Reports (${phaseCosts.length} phases)`}>
        <SaTable
          columns={costColumns}
          rows={phaseCosts}
          loading={loading}
          emptyText="No cost data for this project yet."
          rowKey={(row) => row.phase_id}
        />
      </SaPanel>
    </>
  );
}
