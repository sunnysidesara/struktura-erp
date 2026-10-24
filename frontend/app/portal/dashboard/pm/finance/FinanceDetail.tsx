"use client";

import { useEffect, useState } from "react";
import {
  listPmBudgets,
  listPmPhaseCosts,
  type PmBudget,
  type PmPhaseCost,
  type PmProject,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  Tabs,
  money,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { DetailModal } from "../_components/DetailModal";
import pmStyles from "../page.module.css";

type TabId = "budgets" | "costs";

const TABS: { id: TabId; label: string }[] = [
  { id: "budgets", label: "Budgets" },
  { id: "costs", label: "Cost Reports" },
];

export function FinanceDetail({ project, onClose }: { project: PmProject; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("budgets");
  const [budget, setBudget] = useState<PmBudget | null>(null);
  const [phaseCosts, setPhaseCosts] = useState<PmPhaseCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([listPmBudgets(project.project_id), listPmPhaseCosts(project.project_id)])
      .then(([budgetRows, costRows]) => {
        if (!active) return;
        setBudget(budgetRows[0] ?? null);
        setPhaseCosts(costRows);
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
  }, [project.project_id]);

  const costColumns: SaColumn<PmPhaseCost>[] = [
    { key: "phase", label: "Phase Name", render: (row) => row.phase ?? "-" },
    { key: "labor", label: "Labor Cost", render: (row) => money(row.labor) },
    { key: "materials", label: "Material Cost", render: (row) => money(row.materials) },
    { key: "equipment", label: "Equipment Cost", render: (row) => money(row.equipment) },
    {
      key: "total",
      label: "Total",
      render: (row) => <strong>{money(row.total)}</strong>,
    },
  ];

  return (
    <DetailModal open page="Finance" project={project} onClose={onClose}>
      <Tabs items={TABS} active={tab} onChange={setTab} label="Finance views" />

      {error !== "" ? <p className={pmStyles.noticeError}>{error}</p> : null}

      {tab === "budgets" ? (
        <SaPanel title="Budget summary">
          {loading ? (
            <p className={pmStyles.notice}>Loading budget...</p>
          ) : !budget ? (
            <p className={pmStyles.notice}>No budget recorded for this project.</p>
          ) : (
            <div className={pmStyles.summaryBlock}>
              <div className={pmStyles.summaryItem}>
                <span className={pmStyles.summaryLabel}>Approved Budget</span>
                <strong className={pmStyles.summaryValue}>{money(budget.approved)}</strong>
              </div>
              <span className={pmStyles.summaryDivider} aria-hidden="true" />
              <div className={pmStyles.summaryItem}>
                <span className={pmStyles.summaryLabel}>Overall Spent</span>
                <strong className={pmStyles.summaryValue}>{money(budget.spent)}</strong>
              </div>
              <span className={pmStyles.summaryDivider} aria-hidden="true" />
              <div className={pmStyles.summaryItem}>
                <span className={pmStyles.summaryLabel}>Remaining Balance</span>
                <strong className={pmStyles.summaryValue}>{money(budget.remaining)}</strong>
              </div>
            </div>
          )}
        </SaPanel>
      ) : null}

      {tab === "costs" ? (
        <SaPanel title={`Cost breakdown by phase (${phaseCosts.length})`}>
          <SaTable
            columns={costColumns}
            rows={phaseCosts}
            loading={loading}
            emptyText="No cost data for this project yet."
            rowKey={(row) => row.phase_id}
          />
        </SaPanel>
      ) : null}
    </DetailModal>
  );
}
