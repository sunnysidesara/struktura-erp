"use client";

import { useState } from "react";
import { getSsWorkers, type SsSiteOption, type SsWorker } from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import { SsDetailModal } from "../_components/SsDetailModal";
import { useSsResource } from "../_components/useSsResource";
import styles from "../../sa/page.module.css";

export function WorkersDetail({ site, onClose }: { site: SsSiteOption; onClose: () => void }) {
  const { data, loading, error } = useSsResource(
    () => getSsWorkers(site.project_id),
    site.project_id,
  );
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  const workers = data?.data ?? [];
  const term = query.trim().toLowerCase();
  const rows = workers.filter(
    (row) =>
      term === "" ||
      [row.id, row.name, row.skill, row.contact ?? ""].some((value) =>
        value.toLowerCase().includes(term),
      ),
  );

  const columns: SaColumn<SsWorker>[] = [
    { key: "name", label: "Worker", render: (row) => row.name },
    { key: "skill", label: "Skill", render: (row) => row.skill },
    { key: "contact", label: "Contact", render: (row) => row.contact ?? "-" },
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
                  { label: "Worker ID", value: row.id },
                  { label: "Name", value: row.name },
                  { label: "Primary Skill", value: row.skill },
                  { label: "All Skills", value: row.skills.join(", ") || "-" },
                  { label: "Contact", value: row.contact ?? "-" },
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
    <SsDetailModal page="Workers" site={site} onClose={onClose}>
      <SaPanel
        title={`Workers (${rows.length})`}
        filters={
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            aria-label="Search workers"
          />
        }
      >
        <SaTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          emptyText="No workers are assigned to this site yet."
          rowKey={(row) => row.id}
        />
      </SaPanel>

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Worker details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </SsDetailModal>
  );
}
