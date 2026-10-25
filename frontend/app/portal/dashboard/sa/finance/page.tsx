"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAdminProjects,
  getPmCostReport,
  listPmBudgets,
  listPmPhaseCosts,
  type ApiProject,
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
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../page.module.css";

type ResourceRow = {
  resource: string;
  budget: number;
  spent: number;
  remaining: number;
};

/** Admin projects do not return a `code`, so derive the PRJ-#### label. */
const projectCode = (project: ApiProject) =>
  `PRJ-${String(project.project_id).padStart(4, "0")}`;

const categoryColumns: SaColumn<PmCostReport["categories"][number]>[] = [
  { key: "category", label: "Category", render: (row) => row.category },
  { key: "actual", label: "Actual", render: (row) => money(row.actual) },
];

const resourceColumns: SaColumn<ResourceRow>[] = [
  { key: "resource", label: "Resource", render: (row) => row.resource },
  { key: "budget", label: "Budget", render: (row) => money(row.budget) },
  { key: "spent", label: "Spent", render: (row) => money(row.spent) },
  { key: "remaining", label: "Remaining", render: (row) => money(row.remaining) },
];

const phaseColumns: SaColumn<PmPhaseCost>[] = [
  {
    key: "phase",
    label: "Phase",
    render: (row) => `${row.sequence}. ${row.phase}`,
  },
  { key: "labor", label: "Labor", render: (row) => money(row.labor) },
  { key: "materials", label: "Materials", render: (row) => money(row.materials) },
  { key: "equipment", label: "Equipment", render: (row) => money(row.equipment) },
  {
    key: "total",
    label: "Total",
    render: (row) => <strong>{money(row.total)}</strong>,
  },
];

export default function AdminFinancePage() {
  const {
    data: projectData,
    loading: projectsLoading,
    error: projectsError,
  } = useApiData(getAdminProjects);
  const projects = useMemo<ApiProject[]>(() => projectData ?? [], [projectData]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [budget, setBudget] = useState<PmBudget | null>(null);
  const [report, setReport] = useState<PmCostReport | null>(null);
  const [phaseCosts, setPhaseCosts] = useState<PmPhaseCost[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (selectedId === null && projects.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(projects[0].project_id);
    }
  }, [projects, selectedId]);

  useEffect(() => {
    if (selectedId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBudget(null);
      setReport(null);
      setPhaseCosts([]);
      setDetailError("");
      setDetailLoading(false);

      return;
    }

    let active = true;
    setDetailLoading(true);

    Promise.all([
      listPmBudgets(selectedId),
      getPmCostReport(selectedId),
      listPmPhaseCosts(selectedId),
    ])
      .then(([budgets, costReport, phases]) => {
        if (!active) return;

        setBudget(budgets[0] ?? null);
        setReport(costReport);
        setPhaseCosts(phases);
        setDetailError("");
      })
      .catch((err) => {
        if (active) {
          setDetailError(
            err instanceof Error ? err.message : "Failed to load finance data.",
          );
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected =
    projects.find((project) => project.project_id === selectedId) ?? null;

  const resourceRows: ResourceRow[] = budget
    ? [
        {
          resource: "Materials",
          budget: budget.materials_budget,
          spent: budget.materials_spent,
          remaining: budget.materials_remaining,
        },
        {
          resource: "Equipment",
          budget: budget.equipment_budget,
          spent: budget.equipment_spent,
          remaining: budget.equipment_remaining,
        },
      ]
    : [];

  const value = (amount: number | undefined) =>
    detailLoading ? "..." : money(amount ?? 0);
  const percent = (amount: number | undefined) =>
    detailLoading ? "..." : `${amount ?? 0}%`;

  return (
    <SaPage
      kicker="Finance"
      title="Finance"
      subtitle={
        selected
          ? `${projectCode(selected)} · ${selected.project_name}`
          : "Review project budgets, cost categories and phase costs."
      }
    >
      {projectsError ? <p className={styles.alert}>{projectsError}</p> : null}

      <SaPanel
        title="Project"
        filters={
          <select
            value={selectedId ?? ""}
            onChange={(event) =>
              setSelectedId(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            disabled={projectsLoading || projects.length === 0}
            aria-label="Select project"
          >
            {projects.length === 0 ? (
              <option value="">No projects</option>
            ) : null}
            {projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {projectCode(project)} - {project.project_name}
              </option>
            ))}
          </select>
        }
      >
        <p className={styles.muted}>
          {selected
            ? `Budget, cost categories and phase costs for ${selected.project_name}.`
            : "Select a project to review its costs."}
        </p>
      </SaPanel>

      {detailError ? <p className={styles.alert}>{detailError}</p> : null}

      <MetricGrid>
        <MetricCard
          label="Approved Budget"
          value={value(budget?.approved)}
          note="For this project"
        />
        <MetricCard
          label="Actual Cost"
          value={value(budget?.spent)}
          note="Budget-authoritative spend"
        />
        <MetricCard
          label="Remaining Budget"
          value={value(budget?.remaining)}
          note="Still available"
        />
        <MetricCard
          label="Utilization"
          value={percent(budget?.utilization)}
          note="Of approved budget"
        />
        <MetricCard
          label="Recorded Costs"
          value={value(report?.totals.actual)}
          note="Sum of usage records"
        />
      </MetricGrid>

      <p className={styles.muted}>
        Recorded Costs is the sum of usage records; it can differ from budget
        spend where project budgets were adjusted manually.
      </p>

      <SaPanel title="Cost Categories">
        <SaTable
          columns={categoryColumns}
          rows={report?.categories ?? []}
          loading={detailLoading}
          emptyText="No cost categories for this project."
          rowKey={(row) => row.category}
        />
      </SaPanel>

      <SaPanel title="Resource Budgets">
        <SaTable
          columns={resourceColumns}
          rows={resourceRows}
          loading={detailLoading}
          emptyText="No resource budgets for this project."
          rowKey={(row) => row.resource}
        />
      </SaPanel>

      <SaPanel title={`Phase Costs (${phaseCosts.length})`}>
        <SaTable
          columns={phaseColumns}
          rows={phaseCosts}
          loading={detailLoading}
          emptyText="No phase costs for this project yet."
          rowKey={(row) => row.phase_id}
        />
      </SaPanel>
    </SaPage>
  );
}
