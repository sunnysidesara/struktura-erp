"use client";

import { useState } from "react";
import { getSsPhases, requestSsPhaseCompletion, type SsPhase } from "@/lib/api";
import { SaPanel, SaTable, StatusBadge, type SaColumn } from "@/app/portal/dashboard/sa/_components/SaPage";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import { ProgressBar } from "../_components/SsReport";
import { useSsResource } from "../_components/useSsResource";
import { useSsSite } from "../_components/siteSelection";
import styles from "../../sa/page.module.css";
import ssStyles from "../ss.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

/** Phase list for the selected site, with worker counts and completion requests. */
export function PhasesDetail() {
  const { selectedId } = useSsSite();
  const { data, loading, error, reload } = useSsResource(
    () => getSsPhases(selectedId),
    selectedId,
  );

  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [requesting, setRequesting] = useState<number | null>(null);

  const phases = data?.data ?? [];

  async function requestCompletion(phase: SsPhase) {
    setRequesting(phase.phase_id);
    setNotice(null);

    try {
      const result = await requestSsPhaseCompletion(phase.phase_id);
      setNotice({ type: "success", message: result.message });
      reload();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not send the completion request.",
      });
    } finally {
      setRequesting(null);
    }
  }

  const columns: SaColumn<SsPhase>[] = [
    { key: "name", label: "Phase", render: (row) => `${row.sequence}. ${row.name}` },
    { key: "workers", label: "Workers", render: (row) => String(row.workers) },
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
                  { label: "Workers Assigned", value: row.workers },
                  { label: "Status", value: row.status ?? "-" },
                  {
                    label: "Completion Request",
                    value: row.completionRequestedAt ?? "Not requested",
                  },
                ],
              })
            }
          >
            View
          </button>

          {row.status === "Completed" ? null : row.completionRequestedAt ? (
            <span className={ssStyles.requestedBadge}>Requested</span>
          ) : (
            <button
              type="button"
              className={styles.linkButtonAlt}
              onClick={() => requestCompletion(row)}
              disabled={requesting === row.phase_id}
            >
              {requesting === row.phase_id ? "Sending..." : "Request Completion"}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {notice ? (
        <p className={notice.type === "error" ? ssStyles.noticeError : ssStyles.notice}>
          {notice.message}
        </p>
      ) : null}

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
    </>
  );
}
