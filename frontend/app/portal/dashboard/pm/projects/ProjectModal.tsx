"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createPmProject,
  updatePmProject,
  type PmProject,
  type PmSupervisor,
} from "@/lib/api";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";

export const PROJECT_STATUSES = ["Not Started", "On Track", "Delayed", "On Hold", "Completed"];

type Values = {
  name: string;
  client: string;
  location: string;
  supervisorId: string;
  start: string;
  end: string;
  budget: string;
  materials: string;
  equipment: string;
  status: string;
};

const EMPTY: Values = {
  name: "",
  client: "",
  location: "",
  supervisorId: "",
  start: "",
  end: "",
  budget: "",
  materials: "",
  equipment: "",
  status: "On Track",
};

function dateOnly(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

export function ProjectModal({
  open,
  project,
  supervisors,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The project being edited, or null to create a new one. */
  project: PmProject | null;
  /** Active Site Supervisors available for assignment. */
  supervisors: PmSupervisor[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [nameError, setNameError] = useState("");
  const [dateError, setDateError] = useState("");
  const [supervisorError, setSupervisorError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(
      project
        ? {
            name: project.project_name ?? "",
            client: project.client_name ?? "",
            location: project.location ?? "",
            supervisorId: project.site_supervisor_id
              ? String(project.site_supervisor_id)
              : "",
            start: dateOnly(project.start_date),
            end: dateOnly(project.end_date),
            budget: String(project.approved_budget ?? ""),
            materials: String(project.materials_budget ?? ""),
            equipment: String(project.equipment_budget ?? ""),
            status: project.status ?? "On Track",
          }
        : EMPTY,
    );
    setNameError("");
    setDateError("");
    setSupervisorError("");
    setFormError("");
    setSaving(false);
  }, [open, project]);

  const update = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError("");
    setDateError("");
    setSupervisorError("");
    setFormError("");

    const name = values.name.trim();

    if (!name) {
      setNameError("Project name is required.");
      return;
    }

    if (!values.supervisorId) {
      setSupervisorError("Assign a Site Supervisor before saving the project.");
      return;
    }

    if (values.start && values.end && values.end < values.start) {
      setDateError("Target end date cannot be before the start date.");
      return;
    }

    const budget = values.budget.trim() === "" ? 0 : Number(values.budget);
    const materials = values.materials.trim() === "" ? 0 : Number(values.materials);
    const equipment = values.equipment.trim() === "" ? 0 : Number(values.equipment);

    if (!Number.isFinite(budget) || budget < 0) {
      setFormError("Total budget must be a positive amount.");
      return;
    }

    if (
      !Number.isFinite(materials) ||
      materials < 0 ||
      !Number.isFinite(equipment) ||
      equipment < 0
    ) {
      setFormError("Budget allocations must be positive amounts.");
      return;
    }

    if (Math.round((materials + equipment) * 100) > Math.round(budget * 100)) {
      setFormError("Materials and equipment allocations cannot exceed the total budget.");
      return;
    }

    const payload = {
      project_name: name,
      client_name: values.client.trim() || null,
      location: values.location.trim() || null,
      start_date: values.start || null,
      end_date: values.end || null,
      status: values.status,
      site_supervisor_id: Number(values.supervisorId),
      // All three budget figures are PM-owned and editable at any time.
      approved_budget: budget,
      materials_budget: materials,
      equipment_budget: equipment,
    };

    setSaving(true);

    try {
      if (project) {
        await updatePmProject(project.project_id, payload);
        onSaved("Project updated.");
      } else {
        await createPmProject(payload);
        onSaved("Project created.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const first = (key: string) => error.errors?.[key]?.[0];

        if (first("project_name")) {
          setNameError(first("project_name") as string);
          return;
        }
        if (first("site_supervisor_id")) {
          setSupervisorError(first("site_supervisor_id") as string);
          return;
        }
        if (first("end_date") || first("start_date")) {
          setDateError(first("end_date") ?? (first("start_date") as string));
          return;
        }
      }

      setFormError(
        error instanceof Error ? error.message : "Could not save the project.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      kicker="My Projects"
      title={project ? "Edit Project" : "New Project"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={project ? "Save Changes" : "Create Project"}
      saving={saving}
      error={formError}
    >
      <ModalField label="Project Name" htmlFor="project-name" error={nameError}>
        <input
          id="project-name"
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="e.g. Riverside Condominium"
        />
      </ModalField>

      <ModalGrid>
        <ModalField label="Client" htmlFor="project-client">
          <input
            id="project-client"
            value={values.client}
            onChange={(event) => update("client", event.target.value)}
            placeholder="Client or company"
          />
        </ModalField>
        <ModalField label="Location" htmlFor="project-location">
          <input
            id="project-location"
            value={values.location}
            onChange={(event) => update("location", event.target.value)}
            placeholder="City / site"
          />
        </ModalField>
      </ModalGrid>

      <ModalField
        label="Site Supervisor"
        htmlFor="project-supervisor"
        error={supervisorError}
        hint="Required — the supervisor logs hours, materials and equipment on site."
      >
        <select
          id="project-supervisor"
          value={values.supervisorId}
          onChange={(event) => update("supervisorId", event.target.value)}
        >
          <option value="">Select a Site Supervisor</option>
          {supervisors.map((supervisor) => (
            <option key={supervisor.user_id} value={supervisor.user_id}>
              {supervisor.name} ({supervisor.id_number})
            </option>
          ))}
        </select>
      </ModalField>

      <ModalGrid>
        <ModalField label="Start Date" htmlFor="project-start">
          <input
            id="project-start"
            type="date"
            value={values.start}
            onChange={(event) => update("start", event.target.value)}
          />
        </ModalField>
        <ModalField label="Target End" htmlFor="project-end" error={dateError}>
          <input
            id="project-end"
            type="date"
            value={values.end}
            onChange={(event) => update("end", event.target.value)}
          />
        </ModalField>
      </ModalGrid>

      <ModalGrid>
        <ModalField
          label="Total Budget"
          htmlFor="project-budget"
          hint={project ? "Editing keeps already-logged costs." : "Sets the starting remaining budget."}
        >
          <input
            id="project-budget"
            type="number"
            min="0"
            step="0.01"
            value={values.budget}
            onChange={(event) => update("budget", event.target.value)}
            placeholder="0.00"
          />
        </ModalField>

        <ModalField
          label="Materials Budget Allocation"
          htmlFor="project-materials-budget"
          hint="Portion of the total budget reserved for materials."
        >
          <input
            id="project-materials-budget"
            type="number"
            min="0"
            step="0.01"
            value={values.materials}
            onChange={(event) => update("materials", event.target.value)}
            placeholder="0.00"
          />
        </ModalField>

        <ModalField
          label="Equipment Budget Allocation"
          htmlFor="project-equipment-budget"
          hint="Portion of the total budget reserved for equipment."
        >
          <input
            id="project-equipment-budget"
            type="number"
            min="0"
            step="0.01"
            value={values.equipment}
            onChange={(event) => update("equipment", event.target.value)}
            placeholder="0.00"
          />
        </ModalField>
      </ModalGrid>

      <ModalField label="Status" htmlFor="project-status">
        <select
          id="project-status"
          value={values.status}
          onChange={(event) => update("status", event.target.value)}
        >
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </ModalField>
    </FormModal>
  );
}
