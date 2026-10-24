"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePmPhase,
  listPmPhases,
  listPmSkills,
  type ApiSkill,
  type PmPhase,
  type PmProject,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  Tabs,
  money,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import { PhaseModal } from "./PhaseModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type TabId = "list" | "timeline";
type Notice = { type: "success" | "error"; message: string } | null;

const TABS: { id: TabId; label: string }[] = [
  { id: "list", label: "Phase List" },
  { id: "timeline", label: "Timeline" },
];

export function PhasesPanel({ project }: { project: PmProject }) {
  const [tab, setTab] = useState<TabId>("list");
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PmPhase | null>(null);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([listPmPhases(project.project_id), listPmSkills()])
      .then(([phaseList, skillList]) => {
        setPhases(phaseList);
        setSkills(skillList);
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

  const columns: SaColumn<PmPhase>[] = [
    { key: "name", label: "Phase Name", render: (row) => row.phase_name ?? "-" },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: "end", label: "Planned End", render: (row) => row.planned_end ?? "-" },
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
      <Tabs items={TABS} active={tab} onChange={setTab} label="Phase views" />

      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      {tab === "list" ? (
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
            rows={phases}
            loading={loading}
            error={error}
            emptyText="No phases yet. Use + Add Phase to create the first one."
            rowKey={(row) => row.phase_id}
          />
        </SaPanel>
      ) : (
        <SaPanel title="Phase Schedule">
          <PhaseTimeline phases={phases} loading={loading} error={error} />
        </SaPanel>
      )}

      <PhaseModal
        open={modalOpen}
        phase={editing}
        projects={[project]}
        skills={skills}
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

function toMs(value: string | null): number {
  if (!value) return 0;
  return new Date(value).getTime();
}

/** Palette-only (navy / light blue / gold) gantt bars. */
export function PhaseTimeline({
  phases,
  loading,
  error,
}: {
  phases: PmPhase[];
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return <p className={pmStyles.notice}>Loading schedule...</p>;
  }

  if (error) {
    return <p className={pmStyles.noticeError}>{error}</p>;
  }

  if (phases.length === 0) {
    return <p className={pmStyles.notice}>No phases to display.</p>;
  }

  const starts = phases.map((phase) => toMs(phase.planned_start)).filter((value) => value > 0);
  const ends = phases.map((phase) => toMs(phase.planned_end)).filter((value) => value > 0);
  const min = starts.length ? Math.min(...starts) : 0;
  const max = ends.length ? Math.max(...ends) : 1;
  const span = Math.max(1, max - min);

  const barColor = (status: string | null) => {
    if (status === "Completed") return "#1e3a8a";
    if (status === "In Progress") return "#ca8a04";
    return "#bfdbfe";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {phases.map((phase) => {
        const start = toMs(phase.planned_start);
        const end = toMs(phase.planned_end);
        const left = start ? ((start - min) / span) * 100 : 0;
        const width = start && end ? Math.max(2, ((end - start) / span) * 100) : 2;

        return (
          <div
            key={phase.phase_id}
            style={{ display: "grid", gridTemplateColumns: "220px 1fr 100px", alignItems: "center", gap: "1rem" }}
          >
            <span style={{ fontSize: "0.75rem", color: "#0f172a" }}>{phase.phase_name}</span>
            <div style={{ position: "relative", height: "14px", background: "#f1f5f9", borderRadius: "999px" }}>
              <span
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${width}%`,
                  height: "100%",
                  background: barColor(phase.status),
                  borderRadius: "999px",
                }}
              />
            </div>
            <StatusBadge status={phase.status} />
          </div>
        );
      })}
    </div>
  );
}
