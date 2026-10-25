"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  attachPmLaborerSkill,
  createPmLaborer,
  detachPmLaborerSkill,
  listPmSkills,
  updatePmLaborer,
  type ApiSkill,
  type PmLaborerPayload,
  type PmLaborerProfile,
} from "@/lib/api";
import { FormModal, ModalField, ModalGrid } from "../_components/FormModal";
import styles from "./LaborerModal.module.css";

type FieldErrors = Partial<
  Record<"first_name" | "last_name" | "hourly_rate" | "contact_number" | "date_hired", string>
>;

export function LaborerModal({
  open,
  laborer,
  onClose,
  onSaved,
}: {
  open: boolean;
  laborer: PmLaborerProfile | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [dateHired, setDateHired] = useState("");
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [persistedSkillIds, setPersistedSkillIds] = useState<number[]>([]);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFirstName(laborer?.first_name ?? "");
    setLastName(laborer?.last_name ?? "");
    setHourlyRate(laborer?.hourly_rate != null ? String(laborer.hourly_rate) : "");
    setContactNumber(laborer?.contact_number ?? "");
    setDateHired(laborer?.date_hired ?? "");
    setSelectedSkillIds(laborer?.skills.map((skill) => skill.skill_id) ?? []);
    setPersistedSkillIds(laborer?.skills.map((skill) => skill.skill_id) ?? []);
    setCreatedId(null);
    setFieldErrors({});
    setFormError("");
    setSkillsError("");
    setSaving(false);

    let active = true;
    setLoadingSkills(true);

    listPmSkills()
      .then((rows) => {
        if (active) setSkills(rows);
      })
      .catch((error) => {
        if (active) {
          setSkillsError(error instanceof Error ? error.message : "Failed to load skills.");
        }
      })
      .finally(() => {
        if (active) setLoadingSkills(false);
      });

    return () => {
      active = false;
    };
  }, [open, laborer]);

  const toggleSkill = (skillId: number) => {
    setSelectedSkillIds((current) =>
      current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId],
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    const nextErrors: FieldErrors = {};

    if (!firstName.trim()) {
      nextErrors.first_name = "First name is required.";
    }
    if (!lastName.trim()) {
      nextErrors.last_name = "Last name is required.";
    }
    if (!hourlyRate.trim() || Number.isNaN(Number(hourlyRate)) || Number(hourlyRate) <= 0) {
      nextErrors.hourly_rate = "Enter an hourly rate greater than zero.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const payload: PmLaborerPayload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      hourly_rate: Number(hourlyRate),
      contact_number: contactNumber.trim() || null,
      date_hired: dateHired || null,
    };

    setSaving(true);

    try {
      const targetId = laborer?.laborer_id ?? createdId;
      let laborerId = targetId;

      if (targetId) {
        await updatePmLaborer(targetId, payload);
      } else {
        const created = await createPmLaborer(payload);
        laborerId = created.data.laborer_id;
        setCreatedId(laborerId);
      }

      if (laborerId === null) {
        throw new Error("The laborer could not be saved.");
      }

      const before = new Set(persistedSkillIds);
      const after = new Set(selectedSkillIds);

      for (const skillId of selectedSkillIds) {
        if (!before.has(skillId)) {
          await attachPmLaborerSkill(laborerId, skillId);
          setPersistedSkillIds((current) =>
            current.includes(skillId) ? current : [...current, skillId],
          );
        }
      }

      for (const skillId of before) {
        if (!after.has(skillId)) {
          await detachPmLaborerSkill(laborerId, skillId);
          setPersistedSkillIds((current) => current.filter((id) => id !== skillId));
        }
      }

      const name = `${firstName.trim()} ${lastName.trim()}`;
      onSaved(laborer ? `${name} was updated.` : `${name} was added to the workforce.`);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const first = (key: keyof FieldErrors) => error.errors?.[key]?.[0];

        setFieldErrors({
          first_name: first("first_name"),
          last_name: first("last_name"),
          hourly_rate: first("hourly_rate"),
          contact_number: first("contact_number"),
          date_hired: first("date_hired"),
        });
      }

      setFormError(
        error instanceof Error ? error.message : "Could not save the laborer profile.",
      );
    } finally {
      setSaving(false);
    }
  };


  return (
    <FormModal
      open={open}
      kicker="Workforce"
      title={laborer ? "Edit Laborer" : "Add Laborer"}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={laborer ? "Save Laborer" : "Add Laborer"}
      saving={saving}
      error={formError}
    >
      <ModalGrid>
        <ModalField label="First Name" htmlFor="laborer-first-name" error={fieldErrors.first_name}>
          <input
            id="laborer-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            maxLength={100}
            autoComplete="given-name"
          />
        </ModalField>

        <ModalField label="Last Name" htmlFor="laborer-last-name" error={fieldErrors.last_name}>
          <input
            id="laborer-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={100}
            autoComplete="family-name"
          />
        </ModalField>
      </ModalGrid>

      <ModalGrid>
        <ModalField
          label="Hourly Rate (PHP)"
          htmlFor="laborer-hourly-rate"
          error={fieldErrors.hourly_rate}
          hint="Required; used for labor cost unless an assignment override applies."
        >
          <input
            id="laborer-hourly-rate"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={hourlyRate}
            onChange={(event) => setHourlyRate(event.target.value)}
            placeholder="e.g. 250.00"
          />
        </ModalField>
      </ModalGrid>

      <ModalGrid>
        <ModalField label="Date Hired" htmlFor="laborer-date-hired" error={fieldErrors.date_hired}>
          <input
            id="laborer-date-hired"
            type="date"
            value={dateHired}
            onChange={(event) => setDateHired(event.target.value)}
          />
        </ModalField>

        <ModalField
          label="Contact Number"
          htmlFor="laborer-contact"
          error={fieldErrors.contact_number}
          hint="Optional mobile or landline number."
        >
          <input
            id="laborer-contact"
            value={contactNumber}
            onChange={(event) => setContactNumber(event.target.value)}
            maxLength={50}
            autoComplete="tel"
            placeholder="e.g. 0917-000-0000"
          />
        </ModalField>
      </ModalGrid>

      <ModalField
        label="Trade Skills"
        htmlFor="laborer-skills"
        hint="Select every trade this laborer is qualified to perform."
      >
        <div id="laborer-skills" className={styles.skillList}>
          {loadingSkills ? <span className={styles.skillNote}>Loading skills...</span> : null}
          {!loadingSkills && skills.length === 0 ? (
            <span className={styles.skillNote}>No skills are available yet.</span>
          ) : null}
          {skills.map((skill) => (
            <label key={skill.skill_id} className={styles.skillOption}>
              <input
                type="checkbox"
                checked={selectedSkillIds.includes(skill.skill_id)}
                onChange={() => toggleSkill(skill.skill_id)}
              />
              <span>{skill.skill_name}</span>
            </label>
          ))}
        </div>
      </ModalField>

      {skillsError ? (
        <p className={styles.skillError} role="alert">
          {skillsError}
        </p>
      ) : null}
    </FormModal>
  );
}

