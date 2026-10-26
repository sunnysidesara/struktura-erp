"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { searchPm, type PmSearchResults } from "@/lib/api";
import { SaPage, SaPanel, SaTable, StatusBadge, Tabs, money, type SaColumn } from "@/app/portal/dashboard/sa/_components/SaPage";

type ProjectHit = PmSearchResults["projects"][number];
type PhaseHit = PmSearchResults["phases"][number];
type LaborerHit = PmSearchResults["laborers"][number];

export default function PmSearchPage() {
  return (
    <Suspense fallback={null}>
      <PmSearchResults />
    </Suspense>
  );
}

function PmSearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [results, setResults] = useState<PmSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"projects" | "phases" | "laborers">("projects");

  const runSearch = useCallback(async (value: string) => {
    const q = value.trim();
    if (!q) {
      setResults(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      setResults(await searchPm(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }

    void runSearch(query);
  }, [query, runSearch]);

  const projectColumns: SaColumn<ProjectHit>[] = [
    { key: "name", label: "Project", render: (row) => row.project_name },
    { key: "client", label: "Client", render: (row) => row.client_name ?? "-" },
    { key: "location", label: "Location", render: (row) => row.location ?? "-" },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
  ];

  const phaseColumns: SaColumn<PhaseHit>[] = [
    { key: "project", label: "Project", render: (row) => row.project },
    { key: "name", label: "Phase", render: (row) => row.project_name ?? "-" },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
  ];

  const laborerColumns: SaColumn<LaborerHit>[] = [
    { key: "id", label: "Laborer ID", render: (row) => `LAB-${String(row.laborer_id).padStart(4, "0")}` },
    { key: "name", label: "Name", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "rate", label: "Hourly Rate", render: (row) => money(row.hourly_rate) },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.employment_status} /> },
  ];

  return (
    <SaPage kicker="Search" title="Search" subtitle="Find projects, phases and laborers">
      {loading ? (
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.82rem" }}>Searching...</p>
      ) : error ? (
        <p style={{ margin: 0, color: "#a16207", fontSize: "0.82rem" }}>{error}</p>
      ) : (
        <p style={{ margin: 0, color: "#64748b", fontSize: "0.82rem" }}>
          {results
            ? `Results for "${query}".`
            : "Use the search bar in the top header to search projects, phases and laborers."}
        </p>
      )}

      {results ? (
        <>
          <Tabs
            items={[
              { id: "projects", label: `Projects (${results.projects.length})` },
              { id: "phases", label: `Phases (${results.phases.length})` },
              { id: "laborers", label: `Laborers (${results.laborers.length})` },
            ]}
            active={tab}
            onChange={setTab}
            label="Search result groups"
          />

          {tab === "projects" ? (
            <SaPanel title={`Projects (${results.projects.length})`}>
              <SaTable columns={projectColumns} rows={results.projects} emptyText="No matching projects." rowKey={(row) => row.project_id} />
            </SaPanel>
          ) : null}

          {tab === "phases" ? (
            <SaPanel title={`Phases (${results.phases.length})`}>
              <SaTable columns={phaseColumns} rows={results.phases} emptyText="No matching phases." rowKey={(row) => row.phase_id} />
            </SaPanel>
          ) : null}

          {tab === "laborers" ? (
            <SaPanel title={`Laborers (${results.laborers.length})`}>
              <SaTable columns={laborerColumns} rows={results.laborers} emptyText="No matching laborers." rowKey={(row) => row.laborer_id} />
            </SaPanel>
          ) : null}
        </>
      ) : null}
    </SaPage>
  );
}
