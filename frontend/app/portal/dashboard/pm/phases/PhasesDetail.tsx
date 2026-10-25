"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approvePmPhaseCompletion,
  deletePmPhase,
  listPmPhases,
  rejectPmPhaseCompletion,
  startPmPhase,
  type PmPhase,
  type PmProject,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  money,
  type SaColumn,
  type SaSortState,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import { PhaseModal } from "./PhaseModal";
import { TasksPanel } from "./TasksPanel";
import { StatusActions, type StatusAction } from "../../_components/StatusActions";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

export function PhasesPanel({ project }: { project: PmProject }) {
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [sort, setSort] = useState<SaSortState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PmPhase | null>(null);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listPmPhases(project.project_id)
      .then((phaseList) => {
        setPhases(phaseList);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load phases."),
      )
      .finally(() => setLoading(false));
  }, [project.project_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setEditing(null);
    setNotice({ type: "success", message });
    load();
  };

  const handlePhaseAction = async (phase: PmPhase, action: "start" | "approve" | "reject") => {
    if (
      action === "reject" &&
      !window.confirm("Reject this completion request and keep the phase In Progress?")
    ) {
      return;
    }

    setStatusBusyId(phase.phase_id);
    setNotice(null);

    try {
      const result =
        action === "start"
          ? await startPmPhase(phase.phase_id)
          : action === "approve"
            ? await approvePmPhaseCompletion(phase.phase_id)
            : await rejectPmPhaseCompletion(phase.phase_id);

      setNotice({ type: "success", message: result.message });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not change the phase status.",
      });
    } finally {
      setStatusBusyId(null);
    }
  };

  const phaseStatusActions = (phase: PmPhase): StatusAction[] => {
    if (phase.status === "Not Started") {
      return [
        {
          label: "Start Phase",
          onClick: () => handlePhaseAction(phase, "start"),
          variant: "primary",
        },
      ];
    }

    if (phase.status === "In Progress" && phase.completion_requested_at) {
      return [
        {
          label: "Approve Completion",
          onClick: () => handlePhaseAction(phase, "approve"),
          variant: "primary",
        },
        {
          label: "Reject Request",
          onClick: () => handlePhaseAction(phase, "reject"),
        },
      ];
    }

    return [];
  };

  const handleDelete = async (phase: PmPhase) => {
    if (
      !window.confirm(
        `Delete the phase "${phase.phase_name ?? "phase"}"? Phases with laborers or logged usage cannot be deleted.`,
      )
    ) {
      return;
    }

    try {
      await deletePmPhase(phase.phase_id);
      setNotice({ type: "success", message: "Phase deleted." });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not delete the phase.",
      });
    }
  };

  // Click a sortable header to toggle A-Z / Z-A on the live rows.
  const sortedPhases = useMemo(() => {
    if (!sort) return phases;

    const direction = sort.direction === "asc" ? 1 : -1;
    const value = (row: PmPhase) => {
      switch (sort.key) {
        case "name":
          return row.phase_name ?? "";
        case "status":
          return row.status ?? "";
        case "end":
          return row.planned_end ?? "";
        default:
          return "";
      }
    };

    return [...phases].sort((a, b) => direction * value(a).localeCompare(value(b)));
  }, [phases, sort]);

  const columns: SaColumn<PmPhase>[] = [
    { key: "name", label: "Phase Name", sortable: true, render: (row) => row.phase_name ?? "-" },
    {
      key: "status",
      label: "Status",
      status: true,
      sortable: true,
      render: (row) => (
        <div className={pmStyles.statusCell}>
          <StatusBadge status={row.status} />
          {row.completion_requested_at && row.status !== "Completed" ? (
            <span className={pmStyles.completionBadge}>Completion Requested</span>
          ) : null}
          <StatusActions
            actions={phaseStatusActions(row).map((action) => ({
              ...action,
              disabled: statusBusyId !== null,
            }))}
          />
        </div>
      ),
    },
    { key: "end", label: "Planned End", sortable: true, render: (row) => row.planned_end ?? "-" },
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
                title: row.phase_name ?? "Phase",
                rows: [
                  { label: "Phase", value: row.phase_name ?? "-" },
                  { label: "Sequence", value: row.sequence_no ?? "-" },
                  { label: "Description", value: row.description ?? "-" },
                  { label: "Required Skill", value: row.required_skill ?? "-" },
                  { label: "Planned Start", value: row.planned_start ?? "-" },
                  { label: "Planned End", value: row.planned_end ?? "-" },
                  { label: "Phase Budget", value: money(row.project_cost) },
              { label: "Materials Budget", value: money(row.materials_budget) },
              { label: "Equipment Budget", value: money(row.equipment_budget) },
                  { label: "Status", value: row.status ?? "-" },
              {
                label: "Completion Request",
                value: row.completion_requested_at ?? "Not requested",
              },
                ],
              })
            }
          >
            View
          </button>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setEditing(row);
              setModalOpen(true);
            }}
          >
            Edit
          </button>
          <button type="button" className={styles.linkButtonAlt} onClick={() => handleDelete(row)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel
        title={`Phases (${phases.length})`}
        filters={
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + Add Phase
          </button>
        }
      >
        <SaTable
          columns={columns}
          rows={sortedPhases}
          loading={loading}
          error={error}
          emptyText="No phases yet. Use + Add Phase to create the first one."
          rowKey={(row) => row.phase_id}
          sort={sort}
          onSortChange={setSort}
        />
      </SaPanel>

      <TasksPanel project={project} phases={phases} />

      <PhaseModal
        open={modalOpen}
        phase={editing}
        project={project}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

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

