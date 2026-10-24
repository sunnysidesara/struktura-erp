"use client";

import { useState } from "react";
import { getPmDashboard, type PmProject } from "@/lib/api";
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
import { BarChart } from "@/app/portal/dashboard/pm/_components/PmReport";

type TabId = "projects" | "deadlines" | "costs";

const TABS: { id: TabId; label: string }[] = [
  { id: "projects", label: "My Projects" },
  { id: "deadlines", label: "Upcoming Deadlines" },
  { id: "costs", label: "Cost Breakdown" },
];

export default function ProjectManagerDashboard() {
  const { data, loading, error } = useApiData(getPmDashboard);
  const [tab, setTab] = useState<TabId>("projects");

  const costs = data?.costs;
  const projects = data?.projects ?? [];
  const deadlines = data?.deadlines ?? [];

  const costChart = [
    { label: "Labor", value: costs?.labor ?? 0 },
    { label: "Materials", value: costs?.materials ?? 0 },
    { label: "Equipment", value: costs?.equipment ?? 0 },
  ];

  // Portfolio summary only — 4 columns, everything else lives in the project page.
  const projectColumns: SaColumn<PmProject>[] = [
    { key: "name", label: "Project", render: (row) => row.project_name },
    { key: "remaining", label: "Remaining", render: (row) => money(row.remaining_budget) },
    { key: "progress", label: "Progress", render: (row) => `${row.progress}%` },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const deadlineColumns: SaColumn<PmProject>[] = [
    { key: "name", label: "Project", render: (row) => row.project_name },
    { key: "deadline", label: "Deadline", render: (row) => row.deadline ?? "-" },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <SaPage
      kicker="Project Workspace"
      title="Project Overview"
      subtitle="Portfolio summary across all of your projects"
    >
      {error ? <p style={{ color: "#a16207", fontSize: "0.82rem" }}>{error}</p> : null}

      <Tabs items={TABS} active={tab} onChange={setTab} label="Overview sections" />

      {tab === "projects" ? (
        <SaPanel title={`My Projects (${projects.length})`}>
          <SaTable
            columns={projectColumns}
            rows={projects}
            loading={loading}
            error={error}
            emptyText="No projects assigned."
            rowKey={(row) => row.project_id}
          />
        </SaPanel>
      ) : null}

      {tab === "deadlines" ? (
        <SaPanel title={`Upcoming Deadlines (${deadlines.length})`}>
          <SaTable
            columns={deadlineColumns}
            rows={deadlines}
            loading={loading}
            error={error}
            emptyText="No upcoming deadlines."
            rowKey={(row) => row.project_id}
          />
        </SaPanel>
      ) : null}

      {tab === "costs" ? (
        <SaPanel title="Cost Breakdown">
          <BarChart data={costChart} />
        </SaPanel>
      ) : null}
    </SaPage>
  );
}
