"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createPmTask,
  updatePmTask,
  type PmLaborer,
  type PmPhase,
  type PmProject,
  type PmTask,
  type PmTaskPayload,
} from "@/lib/api";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";

type FieldErrors = Partial<
  Record<"title" | "task_date" | "start_time" | "phase_id" | "assigned_laborer_id", string>
>;

export function TaskModal({
  open,
  task,
  project,
  phases,
  workers,
  onClose,
  onSaved,
}: {
  open: boolean;
  task: PmTask | null;
  project: PmProject;
  phases: PmPhase[];
  workers: PmLaborer[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [assignedLaborerId, setAssignedLaborerId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(task?.title ?? "");
    setPhaseId(task?.phase_id ? String(task.phase_id) : "");
    setTaskDate(task?.date ?? new Date().toISOString().slice(0, 10));
    setStartTime(task?.time ?? "");
    setAssignedLaborerId(task?.assigned_laborer_id ? String(task.assigned_laborer_id) : "");
    setFieldErrors({});
    setFormError("");
    setSaving(false);
  }, [open, task]);

  const phaseWorkers = workers.filter(
    (worker) =>
      String(worker.phase_id ?? "") === phaseId &&
      worker.status === "Active" &&
      worker.employment_status === "Active",
  );

  const hasLegacyAssignee = Boolean(
    task?.assigned_laborer_id &&
      String(task.phase_id ?? "") === phaseId &&
      !phaseWorkers.some((worker) => worker.laborer_id === task.assigned_laborer_id),
  );

  const changePhase = (value: string) => {
    setPhaseId(value);
    setAssignedLaborerId((current) => {
      if (!current) {
        return "";
      }

      const stillAssigned = workers.some(
        (worker) =>
          String(worker.phase_id ?? "") === value &&
          String(worker.laborer_id) === current &&
          worker.status === "Active" &&
          worker.employment_status === "Active",
      );

      return stillAssigned ? current : "";
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const nextErrors: FieldErrors = {};

    if (!title.trim()) {
      nextErrors.title = "Task title is required.";
    }
    if (!taskDate) {
      nextErrors.task_date = "Choose the task date.";
    }
    if (assignedLaborerId && !phaseId) {
      nextErrors.assigned_laborer_id = "Select a phase before assigning a worker.";
    }
    if (
      assignedLaborerId &&
      phaseId &&
      !phaseWorkers.some((worker) => String(worker.laborer_id) === assignedLaborerId) &&
      !hasLegacyAssignee
    ) {
      nextErrors.assigned_laborer_id =
        "The selected worker is not actively assigned to this phase. Assign the worker to the phase first.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const payload: PmTaskPayload = {
      project_id: project.project_id,
      phase_id: phaseId ? Number(phaseId) : null,
      title: title.trim(),
      task_date: taskDate,
      start_time: startTime || null,
      assigned_laborer_id: assignedLaborerId ? Number(assignedLaborerId) : null,
    };

    setSaving(true);

    try {
      if (task) {
        await updatePmTask(task.task_id, payload);
      } else {
        await createPmTask(payload);
      }

      onSaved(task ? "Task updated." : "Task scheduled.");
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const first = (key: keyof FieldErrors) => error.errors?.[key]?.[0];

        setFieldErrors({
          title: first("title"),
          task_date: first("task_date"),
          start_time: first("start_time"),
          phase_id: first("phase_id"),
          assigned_laborer_id: first("assigned_laborer_id"),
        });
      }

      setFormError(error instanceof Error ? error.message : "Could not save the task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      kicker="Schedule"
      title={task ? "Edit Task" : "Schedule Task"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={task ? "Save Task" : "Schedule Task"}
      saving={saving}
      error={formError}
    >
      <ModalField label="Project" htmlFor="task-project">
        <input
          id="task-project"
          value={`${project.code} · ${project.project_name}`}
          readOnly
        />
      </ModalField>

      <ModalField label="Task" htmlFor="task-title" error={fieldErrors.title}>
        <input
          id="task-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
          placeholder="e.g. Concrete pour - Footing 4"
        />
      </ModalField>

      <ModalGrid>
        <ModalField label="Task Date" htmlFor="task-date" error={fieldErrors.task_date}>
          <input
            id="task-date"
            type="date"
            value={taskDate}
            onChange={(event) => setTaskDate(event.target.value)}
          />
        </ModalField>

        <ModalField
          label="Start Time"
          htmlFor="task-time"
          error={fieldErrors.start_time}
          hint="Optional"
        >
          <input
            id="task-time"
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </ModalField>
      </ModalGrid>

      <ModalGrid>
        <ModalField label="Phase" htmlFor="task-phase" error={fieldErrors.phase_id} hint="Optional">
          <select
            id="task-phase"
            value={phaseId}
            onChange={(event) => changePhase(event.target.value)}
          >
            <option value="">Project-level task</option>
            {phases.map((phase) => (
              <option key={phase.phase_id} value={phase.phase_id}>
                {phase.sequence_no}. {phase.phase_name}
              </option>
            ))}
          </select>
        </ModalField>

        <ModalField
          label="Assigned Laborer"
          htmlFor="task-laborer"
          error={fieldErrors.assigned_laborer_id}
          hint="Optional; choose a worker already assigned to the selected phase"
        >
          <select
            id="task-laborer"
            value={assignedLaborerId}
            onChange={(event) => setAssignedLaborerId(event.target.value)}
            disabled={!phaseId}
          >
            <option value="">{phaseId ? "Unassigned" : "Select a phase first"}</option>
            {hasLegacyAssignee ? (
              <option value={String(task?.assigned_laborer_id)}>
                {task?.assignee} (historical — not currently assigned)
              </option>
            ) : null}
            {phaseWorkers.map((worker) => (
              <option key={worker.assignment_id ?? worker.laborer_id} value={worker.laborer_id}>
                {worker.first_name} {worker.last_name}
              </option>
            ))}
          </select>
        </ModalField>
      </ModalGrid>
    </FormModal>
  );
}

