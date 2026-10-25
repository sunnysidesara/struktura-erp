"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSsSearch, type SsSearchResponse } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  Tabs,
  money,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { ProgressBar } from "../_components/SsReport";
import { SsSiteGate } from "../_components/SsSiteGate";
import { useSsSite } from "../_components/siteSelection";
import styles from "../../sa/page.module.css";

type SearchTab = "workers" | "phases" | "tasks" | "materials" | "equipment";
type WorkerHit = SsSearchResponse["workers"][number];
type PhaseHit = SsSearchResponse["phases"][number];
type TaskHit = SsSearchResponse["tasks"][number];
type MaterialHit = SsSearchResponse["materials"][number];
type EquipmentHit = SsSearchResponse["equipment"][number];

const workerColumns: SaColumn<WorkerHit>[] = [
  { key: "id", label: "Worker ID", render: (row) => row.id },
  { key: "name", label: "Worker", render: (row) => row.name },
  {
    key: "status",
    label: "Employment Status",
    status: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "skills",
    label: "Skills",
    render: (row) =>
      row.skills.length > 0 ? row.skills.join(", ") : row.skill || "-",
  },
];

const phaseColumns: SaColumn<PhaseHit>[] = [
  { key: "name", label: "Phase", render: (row) => row.name },
  { key: "progress", label: "Progress", render: (row) => <ProgressBar value={row.progress} /> },
  {
    key: "status",
    label: "Status",
    status: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
];

const taskColumns: SaColumn<TaskHit>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "time", label: "Time", render: (row) => row.time || "-" },
  { key: "task", label: "Task", render: (row) => row.title },
  { key: "phase", label: "Phase", render: (row) => row.phase },
  { key: "worker", label: "Worker", render: (row) => row.assignee },
  {
    key: "status",
    label: "Status",
    status: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
];

const materialColumns: SaColumn<MaterialHit>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "material", label: "Material", render: (row) => row.material },
  {
    key: "quantity",
    label: "Quantity",
    render: (row) => `${row.quantity} ${row.unit ?? ""}`.trim(),
  },
  { key: "phase", label: "Phase", render: (row) => row.phase ?? "-" },
  { key: "expense", label: "Expense", render: (row) => money(row.expense) },
];

const equipmentColumns: SaColumn<EquipmentHit>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "equipment", label: "Equipment", render: (row) => row.equipment },
  { key: "hours", label: "Hours", render: (row) => `${row.hours} h` },
  { key: "phase", label: "Phase", render: (row) => row.phase ?? "-" },
  { key: "expense", label: "Expense", render: (row) => money(row.expense) },
];

export default function SsSearchPage() {
  return (
    <Suspense fallback={null}>
      <SsSearchPageContent />
    </Suspense>
  );
}

function SsSearchPageContent() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Site Supervisor"
      title="Search"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Search within the site selected in My Sites."
      }
    >
      <SsSiteGate>
        {(projectId) => <SsSearchPanel key={projectId} projectId={projectId} />}
      </SsSiteGate>
    </SaPage>
  );
}

function SsSearchPanel({ projectId }: { projectId: number }) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [results, setResults] = useState<SsSearchResponse | null>(null);
  const [tab, setTab] = useState<SearchTab>("workers");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runSearch = useCallback(
    async (value: string) => {
      const q = value.trim();
      if (!q) {
        setResults(null);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        setResults(await getSsSearch(q, projectId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }

    void runSearch(query);
  }, [projectId, query, runSearch]);

  return (
    <>
      {loading ? (
        <p className={styles.muted}>Searching...</p>
      ) : error ? (
        <p className={styles.alert}>{error}</p>
      ) : results ? (
        <p className={styles.muted}>Results for &quot;{query}&quot;.</p>
      ) : (
        <p className={styles.muted}>
          Use the search bar in the top header to search workers, phases, tasks,
          materials and equipment for this site.
        </p>
      )}

      {results ? (
        <>
          <Tabs
            items={[
              { id: "workers", label: `Workers (${results.workers.length})` },
              { id: "phases", label: `Phases (${results.phases.length})` },
              { id: "tasks", label: `Tasks (${results.tasks.length})` },
              { id: "materials", label: `Materials (${results.materials.length})` },
              { id: "equipment", label: `Equipment (${results.equipment.length})` },
            ]}
            active={tab}
            onChange={setTab}
            label="Search result groups"
          />


          {tab === "workers" ? (
            <SaPanel title={`Workers (${results.workers.length})`}>
              <SaTable
                columns={workerColumns}
                rows={results.workers}
                emptyText="No matching workers."
                rowKey={(row) => row.id}
              />
            </SaPanel>
          ) : null}

          {tab === "phases" ? (
            <SaPanel title={`Phases (${results.phases.length})`}>
              <SaTable
                columns={phaseColumns}
                rows={results.phases}
                emptyText="No matching phases."
                rowKey={(row) => row.id}
              />
            </SaPanel>
          ) : null}

          {tab === "tasks" ? (
            <SaPanel title={`Tasks (${results.tasks.length})`}>
              <SaTable
                columns={taskColumns}
                rows={results.tasks}
                emptyText="No matching tasks."
                rowKey={(row) => row.id}
              />
            </SaPanel>
          ) : null}

          {tab === "materials" ? (
            <SaPanel title={`Materials (${results.materials.length})`}>
              <SaTable
                columns={materialColumns}
                rows={results.materials}
                emptyText="No matching materials."
                rowKey={(row) => row.id}
              />
            </SaPanel>
          ) : null}

          {tab === "equipment" ? (
            <SaPanel title={`Equipment (${results.equipment.length})`}>
              <SaTable
                columns={equipmentColumns}
                rows={results.equipment}
                emptyText="No matching equipment."
                rowKey={(row) => row.id}
              />
            </SaPanel>
          ) : null}
        </>
      ) : null}
    </>
  );
}

