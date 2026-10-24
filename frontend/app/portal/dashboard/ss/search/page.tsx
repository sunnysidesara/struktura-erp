"use client";

import { useEffect, useState } from "react";
import {
  getSsSearch,
  type SsEquipmentLog,
  type SsMaterialLog,
  type SsPhase,
  type SsSearchResponse,
  type SsTask,
  type SsWorker,
} from "@/lib/api";
import { SaPage, SaPanel, SaTable, StatusBadge, Tabs, type SaColumn } from "@/app/portal/dashboard/sa/_components/SaPage";
import { ReportFilters } from "../_components/SsReport";

const workerColumns: SaColumn<SsWorker>[] = [
  { key: "id", label: "Worker ID", render: (row) => row.id },
  { key: "name", label: "Name", render: (row) => row.name },
  { key: "skill", label: "Skill", render: (row) => row.skill },
  { key: "contact", label: "Contact", render: (row) => row.contact ?? "-" },
  { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
];

const phaseColumns: SaColumn<SsPhase>[] = [
  { key: "id", label: "Phase", render: (row) => row.id },
  { key: "name", label: "Name", render: (row) => row.name },
  { key: "progress", label: "Progress", render: (row) => `${row.progress}%` },
  { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
];

const taskColumns: SaColumn<SsTask>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "title", label: "Task", render: (row) => row.title },
  { key: "phase", label: "Phase", render: (row) => row.phase },
  { key: "assignee", label: "Assignee", render: (row) => row.assignee },
  { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
];

const materialColumns: SaColumn<SsMaterialLog>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "material", label: "Material", render: (row) => row.material },
  { key: "quantity", label: "Qty", render: (row) => `${row.quantity} ${row.unit ?? ""}`.trim() },
  { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
];

const equipmentColumns: SaColumn<SsEquipmentLog>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "equipment", label: "Equipment", render: (row) => row.equipment },
  { key: "hours", label: "Hours", render: (row) => `${row.hours} h` },
  { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
];

export default function SsSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SsSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"workers" | "phases" | "tasks" | "materials" | "equipment">("workers");

  // The dashboard header search box lands here with ?q=...
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.trim();
    if (q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(q);
    }
  }, []);

  useEffect(() => {
    const q = query.trim();

    if (q === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
       
      setError("");
       
      setLoading(false);
      return;
    }

    let active = true;
     
    setLoading(true);

    const timer = setTimeout(() => {
      getSsSearch(q)
        .then((value) => {
          if (active) {
            setResults(value);
            setError("");
          }
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Search failed.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const total = results
    ? results.workers.length + results.phases.length + results.tasks.length + results.materials.length + results.equipment.length
    : 0;

  return (
    <SaPage kicker="Site Supervisor" title="Search" subtitle="Find workers, phases, tasks, materials, and equipment on your site.">
      <SaPanel title="Search site records">
        <ReportFilters>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            style={{ minWidth: "320px" }}
          />
        </ReportFilters>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
          {query.trim() === ""
            ? "Start typing to search your assigned site records."
            : loading
              ? "Searching..."
              : `Found ${total} matching records for "${query.trim()}".`}
        </p>
      </SaPanel>

      {error !== "" ? (
        <SaPanel title="Search error">
          <p style={{ margin: 0, color: "#a16207", fontSize: "0.86rem" }}>{error}</p>
        </SaPanel>
      ) : null}

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
              <SaTable columns={workerColumns} rows={results.workers} rowKey={(row) => row.id} />
            </SaPanel>
          ) : null}

          {tab === "phases" ? (
            <SaPanel title={`Phases (${results.phases.length})`}>
              <SaTable columns={phaseColumns} rows={results.phases} rowKey={(row) => row.id} />
            </SaPanel>
          ) : null}

          {tab === "tasks" ? (
            <SaPanel title={`Schedule tasks (${results.tasks.length})`}>
              <SaTable columns={taskColumns} rows={results.tasks} rowKey={(row) => row.id} />
            </SaPanel>
          ) : null}

          {tab === "materials" ? (
            <SaPanel title={`Material usage (${results.materials.length})`}>
              <SaTable columns={materialColumns} rows={results.materials} rowKey={(row) => row.id} />
            </SaPanel>
          ) : null}

          {tab === "equipment" ? (
            <SaPanel title={`Equipment usage (${results.equipment.length})`}>
              <SaTable columns={equipmentColumns} rows={results.equipment} rowKey={(row) => row.id} />
            </SaPanel>
          ) : null}
        </>
      ) : null}
    </SaPage>
  );
}
