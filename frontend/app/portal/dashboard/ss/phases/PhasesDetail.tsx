"use client";

import { useState } from "react";
import { getSsPhases, type SsPhase, type SsSiteOption } from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import { SsDetailModal } from "../_components/SsDetailModal";
import { useSsResource } from "../_components/useSsResource";
import { ProgressBar } from "../_components/SsReport";
import styles from "../../sa/page.module.css";

export function PhasesDetail({ site, onClose }: { site: SsSiteOption; onClose: () => void }) {
  const { data, loading, error } = useSsResource(
    () => getSsPhases(site.project_id),
    site.project_id,
  );
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  const phases = data?.data ?? [];

  const columns: SaColumn<SsPhase>[] = [
    { key: "name", label: "Phase", render: (row) => `${row.sequence}. ${row.name}` },
    {
      key: "planned",
      label: "Planned",
      render: (row) => `${row.plannedStart ?? "-"} → ${row.plannedEnd ?? "-"}`,
    },
    { key: "progress", label: "Progress", render: (row) => <ProgressBar value={row.progress} /> },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() =>
              setDetail({
                title: row.name,
                rows: [
                  { label: "Phase", value: row.name },
                  { label: "Description", value: row.description ?? "-" },
                  { label: "Sequence", value: row.sequence },
                  { label: "Planned Start", value: row.plannedStart ?? "-" },
                  { label: "Planned End", value: row.plannedEnd ?? "-" },
                  { label: "Progress", value: `${row.progress}%` },
                  { label: "Status", value: row.status ?? "-" },
                ],
              })
            }
          >
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <SsDetailModal page="Phases" site={site} onClose={onClose}>
      <SaPanel title={`Phases (${phases.length})`}>
        <SaTable
          columns={columns}
          rows={phases}
          loading={loading}
          error={error}
          emptyText="No phases are defined for this site yet."
          rowKey={(row) => row.id}
        />
      </SaPanel>

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Phase details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </SsDetailModal>
  );
}
