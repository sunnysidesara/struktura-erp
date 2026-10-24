"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPmSkillMatch,
  getPmWorkforce,
  listPmPhases,
  type PmLaborer,
  type PmPhase,
  type PmProject,
  type PmWorkforce,
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
import { AssignModal } from "./AssignModal";
import { DetailModal } from "../_components/DetailModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type TabId = "available" | "assigned" | "skill-match";
type Notice = { type: "success" | "error"; message: string } | null;
type AssignedRow = PmWorkforce["assigned"][number];

const TABS: { id: TabId; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "assigned", label: "Assigned" },
  { id: "skill-match", label: "Skill Match" },
];

export function WorkforceDetail({ project, onClose }: { project: PmProject; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("available");
  const [workforce, setWorkforce] = useState<PmWorkforce | null>(null);
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLaborer, setAssignLaborer] = useState<PmLaborer | null>(null);
  const [assignPhaseId, setAssignPhaseId] = useState("");

  const [matchPhaseId, setMatchPhaseId] = useState("");
  const [match, setMatch] = useState<{ required_skill: string | null; data: PmLaborer[] } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getPmWorkforce(project.project_id), listPmPhases(project.project_id)])
      .then(([workforceData, phaseList]) => {
        setWorkforce(workforceData);
        setPhases(phaseList);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load workforce."),
      )
      .finally(() => setLoading(false));
  }, [project.project_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!matchPhaseId && phases.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatchPhaseId(String(phases[0].phase_id));
    }
  }, [phases, matchPhaseId]);

  useEffect(() => {
    if (tab !== "skill-match" || !matchPhaseId) {
      return;
    }

    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatchLoading(true);

    getPmSkillMatch(Number(matchPhaseId))
      .then((response) => {
        if (!active) return;
        setMatch({ required_skill: response.required_skill, data: response.data });
        setMatchError("");
      })
      .catch((err) => {
        if (active) setMatchError(err instanceof Error ? err.message : "Failed to load matches.");
      })
      .finally(() => {
        if (active) setMatchLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tab, matchPhaseId]);

  const skillsOf = (laborerId: number) =>
    (workforce?.skills?.[String(laborerId)] ?? []).join(", ") || "-";

  const openDetails = (row: PmLaborer, phase?: string) => {
    setDetail({
      title: `${row.first_name} ${row.last_name}`,
      rows: [
        { label: "Laborer ID", value: `LAB-${String(row.laborer_id).padStart(4, "0")}` },
        { label: "Name", value: `${row.first_name} ${row.last_name}` },
        { label: "Skills", value: skillsOf(row.laborer_id) },
        { label: "Hourly Rate", value: money(row.hourly_rate) },
        { label: "Employment", value: row.employment_status },
        { label: "Phase", value: phase ?? row.phase ?? "-" },
        { label: "Role on Task", value: row.role_on_task ?? "-" },
      ],
    });
  };

  const handleAssigned = (message: string) => {
    setAssignOpen(false);
    setAssignLaborer(null);
    setNotice({ type: "success", message });
    load();

    if (tab === "skill-match" && matchPhaseId) {
      getPmSkillMatch(Number(matchPhaseId))
        .then((response) =>
          setMatch({ required_skill: response.required_skill, data: response.data }),
        )
        .catch(() => undefined);
    }
  };

  const availableColumns: SaColumn<PmLaborer>[] = [
    { key: "name", label: "Laborer", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "skills", label: "Skills", render: (row) => skillsOf(row.laborer_id) },
    { key: "status", label: "Employment", status: true, render: (row) => <StatusBadge status={row.employment_status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setAssignLaborer(row);
              setAssignPhaseId(matchPhaseId);
              setAssignOpen(true);
            }}
          >
            Assign
          </button>
          <button type="button" className={styles.linkButtonAlt} onClick={() => openDetails(row)}>
            View
          </button>
        </div>
      ),
    },
  ];

  const assignedColumns: SaColumn<AssignedRow>[] = [
    { key: "name", label: "Laborer", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "phase", label: "Phase", render: (row) => row.phase },
    { key: "role", label: "Role on Task", render: (row) => row.role_on_task ?? "-" },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
  ];

  const matchColumns: SaColumn<PmLaborer>[] = [
    { key: "name", label: "Laborer", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "status", label: "Employment", status: true, render: (row) => <StatusBadge status={row.employment_status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setAssignLaborer(row);
              setAssignPhaseId(matchPhaseId);
              setAssignOpen(true);
            }}
          >
            Assign
          </button>
          <button type="button" className={styles.linkButtonAlt} onClick={() => openDetails(row, row.phase)}>
            View
          </button>
        </div>
      ),
    },
  ];

  const available = workforce?.available ?? [];
  const assigned = workforce?.assigned ?? [];
  const matches = match?.data ?? [];

  return (
    <DetailModal open page="Workforce" project={project} onClose={onClose}>
      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      <Tabs items={TABS} active={tab} onChange={setTab} label="Workforce views" />

      {tab === "available" ? (
        <SaPanel title={`Available Laborers (${available.length})`}>
          <SaTable
            columns={availableColumns}
            rows={available}
            loading={loading}
            error={error}
            emptyText="No available laborers — everyone is assigned."
            rowKey={(row) => row.laborer_id}
          />
        </SaPanel>
      ) : null}

      {tab === "assigned" ? (
        <SaPanel title={`Assigned Laborers (${assigned.length})`}>
          <SaTable
            columns={assignedColumns}
            rows={assigned}
            loading={loading}
            error={error}
            emptyText="No laborers are assigned to this project yet."
            rowKey={(row) => row.assignment_id ?? row.laborer_id}
          />
        </SaPanel>
      ) : null}

      {tab === "skill-match" ? (
        <SaPanel
          title="Skill Match"
          filters={
            <select
              value={matchPhaseId}
              onChange={(event) => setMatchPhaseId(event.target.value)}
              aria-label="Select a phase to match laborers"
            >
              {phases.length === 0 ? <option value="">No phases yet</option> : null}
              {phases.map((phase) => (
                <option key={phase.phase_id} value={phase.phase_id}>
                  {phase.sequence_no}. {phase.phase_name}
                </option>
              ))}
            </select>
          }
        >
          {match?.required_skill ? (
            <p className={pmStyles.notice}>
              Required skill: <strong>{match.required_skill}</strong>
            </p>
          ) : null}
          <SaTable
            columns={matchColumns}
            rows={matches}
            loading={matchLoading || loading}
            error={matchError || error}
            emptyText="No qualified laborers are free for this phase."
            rowKey={(row) => row.laborer_id}
          />
        </SaPanel>
      ) : null}

      <AssignModal
        open={assignOpen}
        laborer={assignLaborer}
        phases={phases}
        initialPhaseId={assignPhaseId}
        onClose={() => setAssignOpen(false)}
        onSaved={handleAssigned}
      />

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Laborer details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </DetailModal>
  );
}
