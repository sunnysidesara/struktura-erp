"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createPmPhase,
  updatePmPhase,
  type ApiSkill,
  type PmPhase,
  type PmProject,
} from "@/lib/api";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";

const PHASE_STATUSES = ["Not Started", "In Progress", "Completed"];

type Values = {
  projectId: string;
  name: string;
  description: string;
  sequence: string;
  cost: string;
  start: string;
  end: string;
  skillId: string;
  status: string;
};

const EMPTY: Values = {
  projectId: "",
  name: "",
  description: "",
  sequence: "",
  cost: "",
  start: "",
  end: "",
  skillId: "",
  status: "Not Started",
};

function dateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

export function PhaseModal({
  open,
  phase,
  projects,
  skills,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The phase being edited, or null to create a new one. */
  phase: PmPhase | null;
  projects: PmProject[];
  skills: ApiSkill[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [projectError, setProjectError] = useState("");
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(
      phase
        ? {
            projectId: String(phase.project_id),
            name: phase.phase_name ?? "",
            description: phase.description ?? "",
            sequence: phase.sequence_no === null || phase.sequence_no === undefined ? "" : String(phase.sequence_no),
            cost: phase.project_cost === null || phase.project_cost === undefined ? "" : String(phase.project_cost),
            start: dateOnly(phase.planned_start),
            end: dateOnly(phase.planned_end),
            skillId: phase.required_skill_id ? String(phase.required_skill_id) : "",
            status: phase.status ?? "Not Started",
          }
        : EMPTY,
    );
    setProjectError("");
    setNameError("");
    setFormError("");
    setSaving(false);
  }, [open, phase]);

  const update = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProjectError("");
    setNameError("");
    setFormError("");

    if (!phase && !values.projectId) {
      setProjectError("Select which project this phase belongs to.");
      return;
    }

    if (!values.name.trim()) {
      setNameError("Phase name is required.");
      return;
    }

    const payload = {
      phase_name: values.name.trim(),
      description: values.description.trim() || null,
      sequence_no: values.sequence === "" ? null : Number(values.sequence),
      project_cost: values.cost === "" ? null : Number(values.cost),
      planned_start: values.start || null,
      planned_end: values.end || null,
      status: values.status,
      required_skill_id: values.skillId === "" ? null : Number(values.skillId),
    };

    setSaving(true);

    try {
      if (phase) {
        await updatePmPhase(phase.phase_id, payload);
        onSaved("Phase updated.");
      } else {
        await createPmPhase({ ...payload, project_id: Number(values.projectId) });
        onSaved("Phase created.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const first = (key: string) => error.errors?.[key]?.[0];

        if (first("phase_name")) {
          setNameError(first("phase_name") as string);
          return;
        }
        if (first("project_id")) {
          setProjectError(first("project_id") as string);
          return;
        }
      }

      setFormError(
        error instanceof Error ? error.message : "Could not save the phase.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      kicker="Project Phases"
      title={phase ? "Edit Phase" : "Define Phase"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={phase ? "Save Changes" : "Define Phase"}
      saving={saving}
      error={formError}
    >
      <ModalField label="Project" htmlFor="phase-project" error={projectError}>
        <select
          id="phase-project"
          value={values.projectId}
          onChange={(event) => update("projectId", event.target.value)}
          disabled={Boolean(phase)}
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project.project_id} value={project.project_id}>
              {project.project_name}
            </option>
          ))}
        </select>
      </ModalField>

      <ModalField label="Phase Name" htmlFor="phase-name" error={nameError}>
        <input
          id="phase-name"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="e.g. Foundation Works"
        />
      </ModalField>

      <ModalField label="Description" htmlFor="phase-description">
        <input
          id="phase-description"
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          placeholder="What this phase covers"
        />
      </ModalField>

      <ModalGrid>
        <ModalField label="Sequence" htmlFor="phase-sequence">
          <input
            id="phase-sequence"
            type="number"
            min="1"
            value={values.sequence}
            onChange={(event) => update("sequence", event.target.value)}
            placeholder="1"
          />
        </ModalField>
        <ModalField label="Phase Budget" htmlFor="phase-cost">
          <input
            id="phase-cost"
            type="number"
            min="0"
            step="0.01"
            value={values.cost}
            onChange={(event) => update("cost", event.target.value)}
            placeholder="0.00"
          />
        </ModalField>
      </ModalGrid>

      <ModalGrid>
        <ModalField label="Planned Start" htmlFor="phase-start">
          <input
            id="phase-start"
            type="date"
            value={values.start}
            onChange={(event) => update("start", event.target.value)}
          />
        </ModalField>
        <ModalField label="Planned End" htmlFor="phase-end">
          <input
            id="phase-end"
            type="date"
            value={values.end}
            onChange={(event) => update("end", event.target.value)}
          />
        </ModalField>
      </ModalGrid>

      <ModalGrid>
        <ModalField label="Required Skill" htmlFor="phase-skill">
          <select
            id="phase-skill"
            value={values.skillId}
            onChange={(event) => update("skillId", event.target.value)}
          >
            <option value="">No specific skill</option>
            {skills.map((skill) => (
              <option key={skill.skill_id} value={skill.skill_id}>
                {skill.skill_name}
              </option>
            ))}
          </select>
        </ModalField>
        <ModalField label="Status" htmlFor="phase-status">
          <select
            id="phase-status"
            value={values.status}
            onChange={(event) => update("status", event.target.value)}
          >
            {PHASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </ModalField>
      </ModalGrid>
    </FormModal>
  );
}
