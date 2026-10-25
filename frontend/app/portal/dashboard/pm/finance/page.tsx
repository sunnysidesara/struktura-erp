"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPmCostReport,
  listPmBudgets,
  listPmPhaseCosts,
  type PmBudget,
  type PmCostReport,
  type PmPhaseCost,
} from "@/lib/api";
import {
  MetricCard,
  MetricGrid,
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

const categoryColumns: SaColumn<PmCostReport["categories"][number]>[] = [
  { key: "category", label: "Category", render: (row) => row.category },
  { key: "actual", label: "Actual", render: (row) => money(row.actual) },
];

/** Single-page finance view: KPIs, resource breakdown, per-phase cost reports. */
function FinancePanel({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [budget, setBudget] = useState<PmBudget | null>(null);
  const [phaseCosts, setPhaseCosts] = useState<PmPhaseCost[]>([]);
  const [report, setReport] = useState<PmCostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([
      listPmBudgets(projectId),
      listPmPhaseCosts(projectId),
      getPmCostReport(projectId),
    ])
      .then(([budgets, costs, costReport]) => {
        if (!active) return;
        setBudget(budgets[0] ?? null);
        setPhaseCosts(costs);
        setReport(costReport);
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

  const categoryRows = report
    ? [
        ...report.categories,
        { category: "Total Actual", actual: report.totals.actual },
      ]
    : [];

  return (
    <>
      {error !== "" ? <p className={pmStyles.noticeError}>{error}</p> : null}

      <MetricGrid>
        <MetricCard
          label="Total Budget"
          value={loading ? "..." : money(budget?.approved ?? 0)}
          note="Approved for this project"
        />
        <MetricCard
          label="Total Expenses"
          value={loading ? "..." : money(budget?.spent ?? 0)}
          note={`${budget?.utilization ?? 0}% of the budget used`}
        />
        <MetricCard
          label="Remaining Budget"
          value={loading ? "..." : money(budget?.remaining ?? 0)}
          note="Still available to spend"
        />
      </MetricGrid>

      <SaPanel title="Cost Categories">
        <SaTable
          columns={categoryColumns}
          rows={categoryRows}
          loading={loading}
          emptyText="No cost data for this project yet."
          rowKey={(row) => row.category}
        />

        <div className={pmStyles.breakdownList}>
          <div className={pmStyles.breakdownRow}>
            <div className={pmStyles.breakdownInfo}>
              <p className={pmStyles.breakdownTitle}>Remaining</p>
              <p className={pmStyles.breakdownMeta}>Approved minus actual</p>
            </div>
            <strong>
              {loading
                ? "..."
                : money(budget?.remaining ?? report?.totals.remaining ?? 0)}
            </strong>
          </div>
          <div className={pmStyles.breakdownRow}>
            <div className={pmStyles.breakdownInfo}>
              <p className={pmStyles.breakdownTitle}>Variance</p>
              <p className={pmStyles.breakdownMeta}>Approved minus recorded actual</p>
            </div>
            <strong>{loading ? "..." : money(report?.totals.variance ?? 0)}</strong>
          </div>
          <div className={pmStyles.breakdownRow}>
            <div className={pmStyles.breakdownInfo}>
              <p className={pmStyles.breakdownTitle}>Utilization</p>
              <p className={pmStyles.breakdownMeta}>Of approved budget</p>
            </div>
            <strong>
              {loading
                ? "..."
                : `${report?.totals.utilization ?? budget?.utilization ?? 0}%`}
            </strong>
          </div>
        </div>

        <p className={pmStyles.breakdownMeta} style={{ marginTop: "0.75rem" }}>
          Recorded usage actuals; can differ from budget spend where budgets were
          adjusted manually.
        </p>
      </SaPanel>

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
