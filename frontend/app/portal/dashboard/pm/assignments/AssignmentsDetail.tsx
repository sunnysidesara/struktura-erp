"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPmAssignment,
  deletePmAssignment,
  getPmWorkforce,
  listPmAssignments,
  listPmPhases,
  type PmAssignment,
  type PmLaborer,
  type PmPhase,
  type PmProject,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { RecordDetails, type DetailRow } from "@/app/portal/dashboard/_components/RecordDetails";
import { DetailModal } from "../_components/DetailModal";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

export function AssignmentsDetail({
  project,
  onClose,
}: {
  project: PmProject;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PmAssignment[]>([]);
  const [phases, setPhases] = useState<PmPhase[]>([]);
  const [laborers, setLaborers] = useState<PmLaborer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [detail, setDetail] = useState<{ title: string; rows: DetailRow[] } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [laborerId, setLaborerId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [role, setRole] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      listPmAssignments(project.project_id),
      listPmPhases(project.project_id),
      getPmWorkforce(project.project_id),
    ])
      .then(([assignmentList, phaseList, workforce]) => {
        setRows(assignmentList);
        setPhases(phaseList);
        setLaborers(workforce.available);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load assignments."),
      )
      .finally(() => setLoading(false));
  }, [project.project_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openForm = () => {
    const active = phases.find((phase) => phase.status === "In Progress") ?? phases[0];

    setLaborerId("");
    setPhaseId(active ? String(active.phase_id) : "");
    setRole("");
    setFormError("");
    setFormOpen(true);
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!laborerId) {
      setFormError("Select the laborer to assign.");
      return;
    }
    if (!phaseId) {
      setFormError("Select the phase to assign them to.");
      return;
    }

    setSaving(true);
    try {
      await createPmAssignment({
        laborer_id: Number(laborerId),
        phase_id: Number(phaseId),
        role_on_task: role.trim() || null,
      });

      setFormOpen(false);
      setNotice({ type: "success", message: "Laborer assigned to the phase." });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: PmAssignment) {
    if (
      !window.confirm(
        `Remove ${row.first_name} ${row.last_name} from "${row.phase}"? Assignments with logged hours cannot be removed.`,
      )
    ) {
      return;
    }

    try {
      await deletePmAssignment(row.assignment_id);
      setNotice({
        type: "success",
        message: `${row.first_name} ${row.last_name} was removed from ${row.phase}.`,
      });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not remove the assignment.",
      });
    }
  }

  const columns: SaColumn<PmAssignment>[] = [
    { key: "worker", label: "Worker Name", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "phase", label: "Phase Assigned", render: (row) => row.phase },
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
                title: `${row.first_name} ${row.last_name}`,
                rows: [
                  { label: "Worker", value: `${row.first_name} ${row.last_name}` },
                  { label: "Phase", value: row.phase },
                  { label: "Role on Task", value: row.role_on_task ?? "-" },
                  { label: "Assigned", value: row.assigned_at ?? "-" },
                  { label: "Released", value: row.released_at ?? "-" },
                  { label: "Status", value: row.status ?? "-" },
                ],
              })
            }
          >
            View
          </button>
          <button type="button" className={styles.linkButtonAlt} onClick={() => removeRow(row)}>
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <DetailModal open page="Assignments" project={project} onClose={onClose}>
      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel
        title={`Assigned workers (${rows.length})`}
        filters={
          <button type="button" className={styles.primaryButton} onClick={openForm}>
            + Assign Worker
          </button>
        }
      >
        <SaTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          emptyText="No laborers are assigned to this project yet."
          rowKey={(row) => row.assignment_id}
        />
      </SaPanel>

      <FormModal
        open={formOpen}
        kicker="Assignments"
        title="Assign a worker"
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        submitLabel="Assign worker"
        saving={saving}
        error={formError}
      >
        <ModalField label="Worker" htmlFor="assign-worker">
          <select id="assign-worker" value={laborerId} onChange={(event) => setLaborerId(event.target.value)}>
            <option value="">{laborers.length ? "Select worker" : "No available laborers"}</option>
            {laborers.map((laborer) => (
              <option key={laborer.laborer_id} value={laborer.laborer_id}>
                {laborer.first_name} {laborer.last_name}
              </option>
            ))}
          </select>
        </ModalField>

        <ModalGrid>
          <ModalField label="Phase" htmlFor="assign-phase">
            <select id="assign-phase" value={phaseId} onChange={(event) => setPhaseId(event.target.value)}>
              <option value="">Select phase</option>
              {phases.map((phase) => (
                <option key={phase.phase_id} value={phase.phase_id}>
                  {phase.sequence_no}. {phase.phase_name}
                </option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Role on Task" htmlFor="assign-role" hint="Optional">
            <input
              id="assign-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              maxLength={100}
              placeholder="e.g. Masonry lead"
            />
          </ModalField>
        </ModalGrid>
      </FormModal>

      <RecordDetails
        open={detail !== null}
        title={detail?.title ?? ""}
        subtitle="Assignment details"
        rows={detail?.rows ?? []}
        onClose={() => setDetail(null)}
      />
    </DetailModal>
  );
}
