"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, createSkill, updateSkill, type ApiSkill } from "@/lib/api";
import styles from "./SkillModal.module.css";

/** Trade disciplines offered in the Category dropdown. */
export const SKILL_CATEGORIES = [
  "Structural & Masonry",
  "Finishing",
  "Mechanical, Electrical & Plumbing",
  "Equipment Operations",
  "Safety & Survey",
  "General",
];

export function SkillModal({
  open,
  skill,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The skill being edited, or null to create a new one. */
  skill: ApiSkill | null;
  /** Existing categories from the database, merged into the dropdown. */
  categories: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const options = Array.from(new Set([...SKILL_CATEGORIES, ...categories])).sort();

  // Reset the form each time the modal opens (or switches to another skill).
  useEffect(() => {
    if (!open) {
      return;
    }

    setName(skill?.skill_name ?? "");
    setCategory(skill?.category ?? "");
    setDescription(skill?.description ?? "");
    setNameError("");
    setFormError("");
    setSaving(false);

    nameRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, skill, onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError("");
    setFormError("");

    const trimmed = name.trim();

    if (!trimmed) {
      setNameError("Skill name is required.");
      return;
    }

    const payload = {
      skill_name: trimmed,
      description: description.trim() === "" ? null : description.trim(),
      category: category === "" ? null : category,
    };

    setSaving(true);

    try {
      if (skill) {
        await updateSkill(skill.skill_id, payload);
        onSaved("Skill updated.");
      } else {
        await createSkill(payload);
        onSaved("Skill created.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        const first = (key: string) => error.errors?.[key]?.[0];

        if (first("skill_name")) {
          setNameError(first("skill_name") as string);
          return;
        }
      }

      setFormError(
        error instanceof Error ? error.message : "Could not save the skill.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-modal-title"
      >
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>Reference Data</p>
            <h2 className={styles.title} id="skill-modal-title">
              {skill ? "Edit Skill" : "Add Skill"}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <form className={styles.form} onSubmit={submit} noValidate>
          {formError ? (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="skill-name">Skill Name</label>
            <input
              id="skill-name"
              ref={nameRef}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
              placeholder="e.g. Mason"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "skill-name-error" : undefined}
            />
            {nameError ? (
              <span className={styles.error} id="skill-name-error" role="alert">
                {nameError}
              </span>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="skill-category">Category</label>
            <select
              id="skill-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Uncategorized</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="skill-description">Description</label>
            <textarea
              id="skill-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this trade covers"
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? "Saving..." : skill ? "Save Changes" : "Add Skill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
