"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createPmPhase,
  updatePmPhase,
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
};

function dateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

export function PhaseModal({
  open,
  phase,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The phase being edited, or null to create a new one. */
  phase: PmPhase | null;
  /** The project currently selected in the header; phases always belong to it. */
  project: PmProject;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
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
            name: phase.phase_name ?? "",
            description: phase.description ?? "",
            sequence: phase.sequence_no === null || phase.sequence_no === undefined ? "" : String(phase.sequence_no),
            cost: phase.project_cost === null || phase.project_cost === undefined ? "" : String(phase.project_cost),
            materials: phase.materials_budget === null || phase.materials_budget === undefined ? "" : String(phase.materials_budget),
            equipment: phase.equipment_budget === null || phase.equipment_budget === undefined ? "" : String(phase.equipment_budget),
            start: dateOnly(phase.planned_start),
            end: dateOnly(phase.planned_end),
          }
        : EMPTY,
    );
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
    setNameError("");
    setFormError("");

    if (!values.name.trim()) {
      setNameError("Phase name is required.");
      return;
    }

    const payload = {
      phase_name: values.name.trim(),
      description: values.description.trim() || null,
      sequence_no: values.sequence === "" ? null : Number(values.sequence),
      project_cost: values.cost === "" ? null : Number(values.cost),
      materials_budget: values.materials === "" ? 0 : Number(values.materials),
      equipment_budget: values.equipment === "" ? 0 : Number(values.equipment),
      planned_start: values.start || null,
      planned_end: values.end || null,
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
        <ModalField label="Planned End" htmlFor="phase-end">
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
