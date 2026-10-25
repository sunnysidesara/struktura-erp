"use client";

import { getSsWorkers, type SsWorker } from "@/lib/api";
import {
  MetricCard,
  MetricGrid,
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { SsSiteGate } from "../_components/SsSiteGate";
import { useSsSite } from "../_components/siteSelection";
import { useSsResource } from "../_components/useSsResource";

const columns: SaColumn<SsWorker>[] = [
  { key: "worker", label: "Worker", render: (row) => row.name },
  {
    key: "status",
    label: "Employment Status",
    status: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "skills",
    label: "Skills",
    render: (row) => (row.skills.length > 0 ? row.skills.join(", ") : row.skill || "-"),
  },
];

export default function WorkersPage() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Site Supervisor"
      title="Workers"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Workers assigned to the site selected in My Sites."
      }
    >
      <SsSiteGate>{(projectId) => <WorkersDetail projectId={projectId} />}</SsSiteGate>
    </SaPage>
  );
}

function WorkersDetail({ projectId }: { projectId: number }) {
  const { data, loading, error } = useSsResource(
    () => getSsWorkers(projectId),
    projectId,
  );

  const workers = data?.data ?? [];
  const metrics = data?.metrics;

  return (
    <>
      <MetricGrid>
        <MetricCard
          label="Total Workers"
          value={loading ? "..." : (metrics?.total ?? 0)}
          note="Assigned to this site"
        />
        <MetricCard
          label="Active"
          value={loading ? "..." : (metrics?.active ?? 0)}
          note="Active employment"
        />
        <MetricCard
          label="Inactive"
          value={loading ? "..." : (metrics?.inactive ?? 0)}
          note="Inactive employment"
        />
        <MetricCard
          label="Skills"
          value={loading ? "..." : (metrics?.skills ?? 0)}
          note="Distinct skills on this site"
        />
      </MetricGrid>

      <SaPanel title={`Workers (${workers.length})`}>
        <SaTable
          columns={columns}
          rows={workers}
          loading={loading}
          error={error}
          emptyText="No active workers are assigned to this site yet."
          rowKey={(row) => row.laborer_id}
        />
      </SaPanel>
    </>
  );
}
