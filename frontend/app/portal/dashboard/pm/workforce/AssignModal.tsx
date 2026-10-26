"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createPmAssignment,
  type PmLaborer,
  type PmPhase,
  type PmProject,
} from "@/lib/api";
import { money } from "@/app/portal/dashboard/sa/_components/SaPage";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";

export function AssignModal({
  open,
  laborer,
  project,
  phases,
  initialPhaseId,
  onClose,
  onSaved,
}: {
  open: boolean;
  laborer: PmLaborer | null;
  project: PmProject;
  phases: PmPhase[];
  initialPhaseId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [phaseId, setPhaseId] = useState("");
  const [role, setRole] = useState("");
  const [rateOverride, setRateOverride] = useState("");
  const [phaseError, setPhaseError] = useState("");
  const [rateError, setRateError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPhaseId(initialPhaseId ?? "");
    setRole("");
    setRateOverride("");
    setPhaseError("");
    setRateError("");
    setFormError("");
    setSaving(false);
  }, [open, laborer, initialPhaseId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPhaseError("");
    setRateError("");
    setFormError("");

    if (!laborer) {
      setFormError("Pick a laborer first.");
      return;
    }

    if (!phaseId) {
      setPhaseError("Select which phase to assign this laborer to.");
      return;
    }

    const override = rateOverride.trim() ? Number(rateOverride) : null;

    if (override !== null && (!Number.isFinite(override) || override <= 0)) {
      setRateError("Enter an override greater than zero, or leave it blank.");
      return;
    }

    setSaving(true);

    try {
      await createPmAssignment({
        laborer_id: laborer.laborer_id,
        phase_id: Number(phaseId),
        role_on_task: role.trim() || null,
        hourly_rate_ovveride: override,
      });

      onSaved(`${laborer.first_name} ${laborer.last_name} was assigned to the phase.`);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const first = (key: string) => error.errors?.[key]?.[0];

        if (first("phase_id")) {
          setPhaseError(first("phase_id") as string);
          return;
        }
        if (first("hourly_rate_ovveride")) {
          setRateError(first("hourly_rate_ovveride") as string);
          return;
        }
        if (first("laborer_id")) {
          setFormError(first("laborer_id") as string);
          return;
        }
      }

      setFormError(
        error instanceof Error ? error.message : "Could not create the assignment.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      kicker="Workforce"
      title="Assign Laborer"
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Assign to Phase"
      saving={saving}
      error={formError}
    >
      <ModalField label="Site" htmlFor="assign-site">
        <input
          id="assign-site"
          value={`${project.code} · ${project.project_name}`}
          readOnly
        />
      </ModalField>

      <ModalField label="Laborer" htmlFor="assign-laborer">
        <input
          id="assign-laborer"
          value={laborer ? `${laborer.first_name} ${laborer.last_name}` : ""}
          readOnly
        />
      </ModalField>

      <ModalField label="Phase" htmlFor="assign-phase" error={phaseError}>
        <select
          id="assign-phase"
          value={phaseId}
          onChange={(event) => setPhaseId(event.target.value)}
        >
          <option value="">Select a phase</option>
          {phases.map((phase) => (
            <option key={phase.phase_id} value={phase.phase_id}>
              {phase.sequence_no}. {phase.phase_name}
            </option>
          ))}
        </select>
      </ModalField>

      <ModalGrid>
        <ModalField
          label="Role on Task"
          htmlFor="assign-role"
          hint="Optional, e.g. Masonry lead"
        >
          <input
            id="assign-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            maxLength={100}
            placeholder="Role on task"
          />
        </ModalField>

        <ModalField
          label="Hourly Rate Override"
          htmlFor="assign-rate-override"
          error={rateError}
          hint={
            laborer
              ? `Optional. Base rate: ${money(laborer.hourly_rate)}. Leave blank to use it.`
              : "Optional. Leave blank to use the laborer's base rate."
          }
        >
          <input
            id="assign-rate-override"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={rateOverride}
            onChange={(event) => setRateOverride(event.target.value)}
            placeholder="e.g. 300.00"
          />
        </ModalField>
      </ModalGrid>
    </FormModal>
  );
}
