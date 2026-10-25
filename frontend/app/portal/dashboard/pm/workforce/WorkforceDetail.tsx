"use client";

import { useCallback, useEffect, useState } from "react";
import {
  changePmLaborerStatus,
  deletePmAssignment,
  deletePmLaborer,
  getPmSkillMatch,
  getPmWorkforce,
  listPmLaborers,
  listPmPhases,
  type PmLaborer,
  type PmLaborerProfile,
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
import { LaborerModal } from "./LaborerModal";
import { StatusActions, type StatusAction } from "../../_components/StatusActions";
import { DetailModal } from "../_components/DetailModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type TabId = "available" | "assigned" | "all" | "skill-match";
type Notice = { type: "success" | "error"; message: string } | null;
type AssignedRow = PmWorkforce["assigned"][number];

const TABS: { id: TabId; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "assigned", label: "Assigned" },
  { id: "all", label: "All Laborers" },
  { id: "skill-match", label: "Skill Match" },
];

export function WorkforceDetail({ project, projects, onProjectChange, onClose }: {
  project: PmProject;
  projects: PmProject[];
  onProjectChange: (project: PmProject) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("available");
  const [workforce, setWorkforce] = useState<PmWorkforce | null>(null);
  const [laborers, setLaborers] = useState<PmLaborerProfile[]>([]);
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [deletingLaborerId, setDeletingLaborerId] = useState<number | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);
  const [laborerOpen, setLaborerOpen] = useState(false);
  const [editingLaborer, setEditingLaborer] = useState<PmLaborerProfile | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLaborer, setAssignLaborer] = useState<PmLaborer | null>(null);
  const [assignPhaseId, setAssignPhaseId] = useState("");

  const [matchPhaseId, setMatchPhaseId] = useState("");
  const [match, setMatch] = useState<{ required_skill: string | null; data: PmLaborer[] } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getPmWorkforce(project.project_id),
      listPmPhases(project.project_id),
      listPmLaborers(),
    ])
      .then(([workforceData, phaseList, laborerList]) => {
        setWorkforce(workforceData);
        setPhases(phaseList);
        setLaborers(laborerList);
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
    // Reset phase-scoped controls when the PM switches sites.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatchPhaseId("");
    setAssignPhaseId("");
    setAssignLaborer(null);
    setAssignOpen(false);
  }, [project.project_id]);

  useEffect(() => {
    const validPhase = phases.some((phase) => String(phase.phase_id) === matchPhaseId);

    if (phases.length > 0 && !validPhase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatchPhaseId(String(phases[0].phase_id));
    } else if (phases.length === 0 && matchPhaseId) {
      setMatchPhaseId("");
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

  const skillsOf = (laborerId: number) => {
    const fromWorkforce = workforce?.skills?.[String(laborerId)] ?? [];
    if (fromWorkforce.length > 0) {
      return fromWorkforce.join(", ");
    }

    return (
      laborers
        .find((laborer) => laborer.laborer_id === laborerId)
        ?.skills.map((skill) => skill.skill_name)
        .join(", ") || "-"
    );
  };

  const effectiveRate = (row: PmLaborer) =>
    row.hourly_rate_ovveride !== null && row.hourly_rate_ovveride !== undefined
      ? Number(row.hourly_rate_ovveride)
      : Number(row.hourly_rate);

  const refreshSkillMatch = () => {
    if (!matchPhaseId) {
      return;
    }

    getPmSkillMatch(Number(matchPhaseId))
      .then((response) =>
        setMatch({ required_skill: response.required_skill, data: response.data }),
      )
      .catch(() => undefined);
  };

  const openNewLaborer = () => {
    setEditingLaborer(null);
    setLaborerOpen(true);
  };

  const openEditLaborer = (laborerId: number) => {
    const profile = laborers.find((laborer) => laborer.laborer_id === laborerId);

    if (!profile) {
      setNotice({
        type: "error",
        message: "The laborer profile could not be loaded. Refresh and try again.",
      });
      return;
    }

    setEditingLaborer(profile);
    setLaborerOpen(true);
  };

  const handleLaborerSaved = (message: string) => {
    setLaborerOpen(false);
    setEditingLaborer(null);
    setNotice({ type: "success", message });
    load();

    if (tab === "skill-match") {
      refreshSkillMatch();
    }
  };

  const laborerStatusActions = (profile: PmLaborerProfile): StatusAction[] => {
    const run = (status: string) => () => handleLaborerStatus(profile, status);

    if (profile.employment_status === "Active") {
      return [
        { label: "Deactivate", onClick: run("Inactive") },
        { label: "Terminate", onClick: run("Terminated") },
      ];
    }

    if (profile.employment_status === "Inactive") {
      return [
        { label: "Reactivate", onClick: run("Active"), variant: "primary" },
        { label: "Terminate", onClick: run("Terminated") },
      ];
    }

    return [];
  };

  const handleLaborerStatus = async (profile: PmLaborerProfile, status: string) => {
    if (
      status === "Terminated" &&
      !window.confirm(`Terminate ${profile.full_name}? This is final.`)
    ) {
      return;
    }

    setStatusBusyId(profile.laborer_id);
    setNotice(null);

    try {
      const result = await changePmLaborerStatus(profile.laborer_id, status);
      setNotice({ type: "success", message: result.message });
      load();

      if (tab === "skill-match") {
        refreshSkillMatch();
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not change the worker status.",
      });
    } finally {
      setStatusBusyId(null);
    }
  };

  const handleDeleteLaborer = async (laborerId: number) => {
    const profile = laborers.find((laborer) => laborer.laborer_id === laborerId);

    if (!profile) {
      setNotice({
        type: "error",
        message: "The laborer profile could not be loaded. Refresh and try again.",
      });
      return;
    }

    if (
      !window.confirm(
        `Delete ${profile.first_name} ${profile.last_name}? Laborers with assignments or logged hours cannot be deleted.`,
      )
    ) {
      return;
    }

    setDeletingLaborerId(laborerId);
    setNotice(null);

    try {
      const result = await deletePmLaborer(laborerId);
      setNotice({
        type: "success",
        message: result.message || "Laborer deleted successfully.",
      });
      load();

      if (tab === "skill-match") {
        refreshSkillMatch();
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Could not delete the laborer.",
      });
    } finally {
      setDeletingLaborerId(null);
    }
  };

  const openDetails = (row: PmLaborer, phase?: string) => {
    const profile = laborers.find((laborer) => laborer.laborer_id === row.laborer_id);

    setDetail({
      title: `${row.first_name} ${row.last_name}`,
      rows: [
        { label: "Laborer ID", value: `LAB-${String(row.laborer_id).padStart(4, "0")}` },
        { label: "Name", value: `${row.first_name} ${row.last_name}` },
        { label: "Skills", value: skillsOf(row.laborer_id) },
        { label: "Base Rate", value: money(row.hourly_rate) },
        {
          label: "Assignment Override",
          value:
            row.hourly_rate_ovveride !== null && row.hourly_rate_ovveride !== undefined
              ? money(row.hourly_rate_ovveride)
              : "-",
        },
        { label: "Effective Rate", value: money(effectiveRate(row)) },
        { label: "Employment", value: row.employment_status },
        { label: "Contact Number", value: profile?.contact_number ?? "-" },
        { label: "Date Hired", value: profile?.date_hired ?? "-" },
        { label: "Phase", value: phase ?? row.phase ?? "-" },
        { label: "Role on Task", value: row.role_on_task ?? "-" },
      ],
    });
  };

  const openProfileDetails = (row: PmLaborerProfile) => {
    setDetail({
      title: row.full_name,
      rows: [
        { label: "Laborer ID", value: `LAB-${String(row.laborer_id).padStart(4, "0")}` },
        { label: "Name", value: row.full_name },
        { label: "Skills", value: row.skills.map((skill) => skill.skill_name).join(", ") || "-" },
        { label: "Base Rate", value: money(row.hourly_rate) },
        { label: "Employment", value: row.employment_status ?? "-" },
        { label: "Contact Number", value: row.contact_number ?? "-" },
        { label: "Date Hired", value: row.date_hired ?? "-" },
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

  const handleRemove = async (row: AssignedRow) => {
    const assignmentId = row.assignment_id;

    if (!assignmentId) {
      setNotice({
        type: "error",
        message: "This assignment cannot be removed because its ID is missing. Refresh and try again.",
      });
      return;
    }

    if (
      !window.confirm(
        `Remove ${row.first_name} ${row.last_name} from ${row.phase ?? "this phase"}? Assignments with logged hours cannot be removed.`,
      )
    ) {
      return;
    }

    setRemovingId(assignmentId);
    setNotice(null);

    try {
      const result = await deletePmAssignment(assignmentId);
      setNotice({
        type: "success",
        message: result.message || "Laborer removed from the phase.",
      });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not remove the assignment.",
      });
    } finally {
      setRemovingId(null);
    }
  };

  const availableColumns: SaColumn<PmLaborer>[] = [
    { key: "name", label: "Laborer", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "rate", label: "Hourly Rate", render: (row) => money(row.hourly_rate) },
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
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => openEditLaborer(row.laborer_id)}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => handleDeleteLaborer(row.laborer_id)}
            disabled={deletingLaborerId !== null}
          >
            {deletingLaborerId === row.laborer_id ? "Deleting..." : "Delete"}
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
    {
      key: "rate",
      label: "Effective Rate",
      render: (row) => money(effectiveRate(row)),
    },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => openEditLaborer(row.laborer_id)}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => handleRemove(row)}
            disabled={removingId !== null || !row.assignment_id}
          >
            {removingId === row.assignment_id ? "Removing..." : "Remove"}
          </button>
        </div>
      ),
    },
  ];

  const matchColumns: SaColumn<PmLaborer>[] = [
    { key: "name", label: "Laborer", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "rate", label: "Hourly Rate", render: (row) => money(row.hourly_rate) },
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
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => openEditLaborer(row.laborer_id)}
          >
            Edit
          </button>
          <button type="button" className={styles.linkButtonAlt} onClick={() => openDetails(row, row.phase)}>
            View
          </button>
        </div>
      ),
    },
  ];

  const allColumns: SaColumn<PmLaborerProfile>[] = [
    { key: "name", label: "Laborer", render: (row) => row.full_name },
    {
      key: "rate",
      label: "Base Rate",
      render: (row) => money(row.hourly_rate),
    },
    {
      key: "skills",
      label: "Skills",
      render: (row) => row.skills.map((skill) => skill.skill_name).join(", ") || "-",
    },
    {
      key: "status",
      label: "Employment",
      status: true,
      render: (row) => <StatusBadge status={row.employment_status ?? "Unknown"} />,
    },
    { key: "contact", label: "Contact", render: (row) => row.contact_number ?? "-" },
    {
      key: "statusActions",
      label: "Status Actions",
      render: (row) => (
        <StatusActions
          actions={laborerStatusActions(row).map((action) => ({
            ...action,
            disabled: statusBusyId !== null,
          }))}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => openEditLaborer(row.laborer_id)}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => handleDeleteLaborer(row.laborer_id)}
            disabled={deletingLaborerId !== null}
          >
            {deletingLaborerId === row.laborer_id ? "Deleting..." : "Delete"}
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => openProfileDetails(row)}
          >
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

      <div className={pmStyles.siteSelectorWrap}>
        <span className={pmStyles.siteSelectorLabel}>Site</span>
        <select
          className={pmStyles.siteSelector}
          value={project.project_id}
          onChange={(event) => {
            const next = projects.find(
              (candidate) => candidate.project_id === Number(event.target.value),
            );

            if (next && next.project_id !== project.project_id) {
              onProjectChange(next);
            }
          }}
          aria-label="Select the site to manage"
        >
          {projects.map((candidate) => (
            <option key={candidate.project_id} value={candidate.project_id}>
              {candidate.code} · {candidate.project_name}
            </option>
          ))}
        </select>
      </div>

      <Tabs items={TABS} active={tab} onChange={setTab} label="Workforce views" />

      {tab === "available" ? (
        <SaPanel
          title={`Available Laborers (${available.length})`}
          filters={
            <button type="button" className={pmStyles.assignButton} onClick={openNewLaborer}>
              + Add Laborer
            </button>
          }
        >
          <SaTable
            columns={availableColumns}
            rows={available}
            loading={loading}
            error={error}
            emptyText="No available laborers for this site — everyone is assigned."
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

      {tab === "all" ? (
        <SaPanel
          title={`All Laborers (${laborers.length})`}
          filters={
            <button type="button" className={pmStyles.assignButton} onClick={openNewLaborer}>
              + Add Laborer
            </button>
          }
        >
          <SaTable
            columns={allColumns}
            rows={laborers}
            loading={loading}
            error={error}
            emptyText="No laborers have been added yet."
            rowKey={(row) => row.laborer_id}
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
        project={project}
        phases={phases}
        initialPhaseId={assignPhaseId}
        onClose={() => setAssignOpen(false)}
        onSaved={handleAssigned}
      />

      <LaborerModal
        open={laborerOpen}
        laborer={editingLaborer}
        onClose={() => {
          setLaborerOpen(false);
          setEditingLaborer(null);
        }}
        onSaved={handleLaborerSaved}
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
