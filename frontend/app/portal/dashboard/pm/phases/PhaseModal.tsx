"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createPmPhase,
  listPmSkills,
  updatePmPhase,
  type ApiSkill,
  type PmPhase,
  type PmProject,
} from "@/lib/api";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";

type Values = {
  name: string;
  description: string;
  sequence: string;
  cost: string;
  materials: string;
  equipment: string;
  start: string;
  end: string;
  skillId: string;
};

const EMPTY: Values = {
  name: "",
  description: "",
  sequence: "",
  cost: "",
  materials: "",
  equipment: "",
  start: "",
  end: "",
  skillId: "",
};

function dateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

export function PhaseModal({
  open,
  phase,
  project,
  phases,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The phase being edited, or null to create a new one. */
  phase: PmPhase | null;
  /** The project currently selected in the header; phases always belong to it. */
  project: PmProject;
  /** Existing phases are used to validate project-wide budget allocations. */
  phases: PmPhase[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [nameError, setNameError] = useState("");
  const [dateError, setDateError] = useState("");
  const [skillError, setSkillError] = useState("");
  const [formError, setFormError] = useState("");
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(
      phase
        ? {
            name: phase.phase_name ?? "",
            description: phase.description ?? "",
            sequence: phase.sequence_no === null || phase.sequence_no === undefined ? "" : String(phase.sequence_no),
            cost: phase.project_cost === null || phase.project_cost === undefined ? "" : String(phase.project_cost),
            materials: phase.materials_budget === null || phase.materials_budget === undefined ? "" : String(phase.materials_budget),
            equipment: phase.equipment_budget === null || phase.equipment_budget === undefined ? "" : String(phase.equipment_budget),
            start: dateOnly(phase.planned_start),
            end: dateOnly(phase.planned_end),
            skillId:
              phase.required_skill_id === null || phase.required_skill_id === undefined
                ? ""
                : String(phase.required_skill_id),
          }
        : EMPTY,
    );
    setNameError("");
    setDateError("");
    setSkillError("");
    setFormError("");
    setSaving(false);
  }, [open, phase]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setSkillsLoading(true);

    listPmSkills()
      .then((rows) => {
        if (active) {
          setSkills(rows);
        }
      })
      .catch((err) => {
        if (active) {
          setSkillError(
            err instanceof Error ? err.message : "Could not load the skill list.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setSkillsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open]);

  const update = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError("");
    setDateError("");
    setSkillError("");
    setFormError("");

    if (!values.name.trim()) {
      setNameError("Phase name is required.");
      return;
    }

    if (values.start && values.end && values.end < values.start) {
      setDateError("Planned end date cannot be before the planned start date.");
      return;
    }

    const projectStart = dateOnly(project.start_date);
    const projectEnd = dateOnly(project.end_date);

    if (values.start && projectStart && values.start < projectStart) {
      setDateError("Planned start date cannot be before the project start date.");
      return;
    }

    if (values.end && projectEnd && values.end > projectEnd) {
      setDateError("Planned end date cannot be after the project end date.");
      return;
    }

    const cost = values.cost === "" ? 0 : Number(values.cost);
    const materials = values.materials === "" ? 0 : Number(values.materials);
    const equipment = values.equipment === "" ? 0 : Number(values.equipment);

    if (
      !Number.isFinite(cost) ||
      cost < 0 ||
      !Number.isFinite(materials) ||
      materials < 0 ||
      !Number.isFinite(equipment) ||
      equipment < 0
    ) {
      setFormError("Phase budgets must be positive amounts.");
      return;
    }

    const otherPhases = phases.filter(
      (row) => row.phase_id !== phase?.phase_id,
    );
    const allocatedCost =
      otherPhases.reduce((sum, row) => sum + Number(row.project_cost ?? 0), 0) + cost;
    const allocatedMaterials =
      otherPhases.reduce((sum, row) => sum + Number(row.materials_budget ?? 0), 0) +
      materials;
    const allocatedEquipment =
      otherPhases.reduce((sum, row) => sum + Number(row.equipment_budget ?? 0), 0) +
      equipment;

    if (
      Math.round(allocatedCost * 100) > Math.round(project.approved_budget * 100) ||
      Math.round(allocatedMaterials * 100) > Math.round(project.materials_budget * 100) ||
      Math.round(allocatedEquipment * 100) > Math.round(project.equipment_budget * 100)
    ) {
      setFormError("Invalid: The set budget exceeds the allocated budget limit.");
      return;
    }

    const payload = {
      phase_name: values.name.trim(),
      description: values.description.trim() || null,
      sequence_no: values.sequence === "" ? null : Number(values.sequence),
      project_cost: values.cost === "" ? null : cost,
      materials_budget: materials,
      equipment_budget: equipment,
      planned_start: values.start || null,
      planned_end: values.end || null,
      required_skill_id: values.skillId === "" ? null : Number(values.skillId),
    };

    setSaving(true);

    try {
      if (phase) {
        await updatePmPhase(phase.phase_id, payload);
        onSaved("Phase updated.");
      } else {
        await createPmPhase({ ...payload, project_id: project.project_id });
        onSaved("Phase created.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const first = (key: string) => error.errors?.[key]?.[0];

        if (first("phase_name")) {
          setNameError(first("phase_name") as string);
          return;
        }
        if (first("planned_start") || first("planned_end")) {
          setDateError(
            (first("planned_start") ?? first("planned_end")) as string,
          );
          return;
        }
        if (first("required_skill_id")) {
          setSkillError(first("required_skill_id") as string);
          return;
        }
        if (
          first("project_cost") ||
          first("materials_budget") ||
          first("equipment_budget")
        ) {
          setFormError(
            first("project_cost") ??
              first("materials_budget") ??
              (first("equipment_budget") as string),
          );
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
      <ModalField label="Project" htmlFor="phase-project">
        <input
          id="phase-project"
          value={`${project.project_name} (${project.code})`}
          readOnly
        />
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

      <ModalField
        label="Required Skill"
        htmlFor="phase-skill"
        error={skillError}
        hint="Optional; used for the PM skill-match recommendation."
      >
        <select
          id="phase-skill"
          value={values.skillId}
          onChange={(event) => update("skillId", event.target.value)}
          disabled={skillsLoading}
        >
          <option value="">
            {skillsLoading ? "Loading skills..." : "No specific skill"}
          </option>
          {phase?.required_skill_id &&
          !skills.some((skill) => skill.skill_id === phase.required_skill_id) ? (
            <option value={String(phase.required_skill_id)}>
              {phase.required_skill ?? "Current skill"}
            </option>
          ) : null}
          {skills.map((skill) => (
            <option key={skill.skill_id} value={skill.skill_id}>
              {skill.skill_name}
            </option>
          ))}
        </select>
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
        <ModalField label="Materials Budget" htmlFor="phase-materials">
          <input
            id="phase-materials"
            type="number"
            min="0"
            step="0.01"
            value={values.materials}
            onChange={(event) => update("materials", event.target.value)}
            placeholder="0.00"
          />
        </ModalField>
        <ModalField label="Equipment Budget" htmlFor="phase-equipment">
          <input
            id="phase-equipment"
            type="number"
            min="0"
            step="0.01"
            value={values.equipment}
            onChange={(event) => update("equipment", event.target.value)}
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
        <ModalField label="Planned End" htmlFor="phase-end" error={dateError}>
          <input
            id="phase-end"
            type="date"
            value={values.end}
            onChange={(event) => update("end", event.target.value)}
          />
        </ModalField>
      </ModalGrid>
    </FormModal>
  );
}
