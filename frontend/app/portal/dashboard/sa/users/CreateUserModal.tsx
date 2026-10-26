"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  createUser,
  listRoles,
  type ApiRoleItem,
  type ApiUserRow,
} from "@/lib/api";
import styles from "./CreateUserModal.module.css";

// Dropdown label -> role_name stored in the database (`Admin` is the
// System Administrator role).
const ROLE_OPTIONS = [
  { label: "System Administrator", roleName: "Admin" },
  { label: "Project Manager", roleName: "Project Manager" },
  { label: "Site Supervisor", roleName: "Site Supervisor" },
] as const;

type Values = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
};

type FieldErrors = Partial<Record<keyof Values, string>>;

const EMPTY_VALUES: Values = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Pure client-side check: required fields, email shape, password length. */
function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  const fullName = values.fullName.trim();

  if (!fullName) {
    errors.fullName = "Full name is required.";
  } else if (fullName.split(/\s+/).length < 2) {
    errors.fullName = "Enter the first and last name.";
  }

  const email = values.email.trim();
  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 12 characters.";
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = "Please confirm the password.";
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (!values.role) {
    errors.role = "Select a role.";
  }

  return errors;
}

/** Split "Jane Dela Cruz" at the last space; the API stores names separately. */
function splitFullName(value: string): {
  first_name: string;
  last_name: string;
} {
  const parts = value.trim().split(/\s+/);

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1] ?? "",
  };
}

export function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (user: ApiUserRow) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [roles, setRoles] = useState<ApiRoleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const fullNameRef = useRef<HTMLInputElement | null>(null);

  // Reset the form and load the assignable roles every time it opens.
  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(EMPTY_VALUES);
    setErrors({});
    setFormError("");
    setSaving(false);

    let active = true;
    listRoles()
      .then((data) => {
        if (active) setRoles(data);
      })
      .catch(() => {
        if (active) setRoles([]);
      });

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    fullNameRef.current?.focus();

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
  }, [open, onClose]);

  const update = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next: FieldErrors = { ...current, [key]: undefined };

      // Editing either password field invalidates a previous mismatch error.
      if (key === "password" || key === "confirmPassword") {
        next.password = undefined;
        next.confirmPassword = undefined;
      }

      return next;
    });
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    const roleOption = ROLE_OPTIONS.find(
      (option) => option.label === values.role,
    );
    const role = roleOption
      ? roles.find((item) => item.role_name === roleOption.roleName)
      : undefined;

    if (!role) {
      setFormError(
        "That role is not available right now. Close the dialog and try again.",
      );
      return;
    }

    const { first_name, last_name } = splitFullName(values.fullName);

    setSaving(true);
    setFormError("");

    try {
      const result = await createUser({
        first_name,
        last_name,
        email: values.email.trim(),
        password: values.password,
        // The user retypes the password in the confirm field; the API validates
        // that both values match.
        password_confirmation: values.confirmPassword,
        role_id: role.role_id,
      });

      onCreated(result.data);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const serverErrors: FieldErrors = {};
        const first = (key: string) => err.errors?.[key]?.[0];

        const nameError = first("first_name") ?? first("last_name");
        if (nameError) serverErrors.fullName = nameError;
        if (first("email")) serverErrors.email = first("email");
        if (first("password")) serverErrors.password = first("password");
        if (first("password_confirmation")) {
          serverErrors.confirmPassword = first("password_confirmation");
        }
        if (first("role_id")) serverErrors.role = first("role_id");

        if (Object.values(serverErrors).some(Boolean)) {
          setErrors(serverErrors);
          return;
        }
      }

      setFormError(
        err instanceof Error ? err.message : "Failed to create the account.",
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
        aria-labelledby="create-user-title"
      >
        <header className={styles.modalHead}>
          <div>
            <p className={styles.kicker}>User Management</p>
            <h2 className={styles.title} id="create-user-title">
              Create User
            </h2>
            <p className={styles.subtitle}>
              The account ID is generated automatically from the selected role.
            </p>
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
            <label htmlFor="create-user-full-name">Full Name</label>
            <input
              id="create-user-full-name"
              ref={fullNameRef}
              value={values.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              placeholder="Jane Dela Cruz"
              autoComplete="name"
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={
                errors.fullName ? "create-user-full-name-error" : undefined
              }
            />
            {errors.fullName ? (
              <span
                className={styles.error}
                id="create-user-full-name-error"
                role="alert"
              >
                {errors.fullName}
              </span>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="create-user-email">Email</label>
            <input
              id="create-user-email"
              type="email"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="jane.delacruz@struktura.com"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={
                errors.email ? "create-user-email-error" : undefined
              }
            />
            {errors.email ? (
              <span
                className={styles.error}
                id="create-user-email-error"
                role="alert"
              >
                {errors.email}
              </span>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="create-user-password">Password</label>
            <input
              id="create-user-password"
              type="password"
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
              placeholder="At least 12 characters"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password
                  ? "create-user-password-error"
                  : "create-user-password-hint"
              }
            />
            {errors.password ? (
              <span
                className={styles.error}
                id="create-user-password-error"
                role="alert"
              >
                {errors.password}
              </span>
            ) : (
              <span className={styles.hint} id="create-user-password-hint">
                Minimum of 8 characters.
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="create-user-confirm-password">
              Confirm Password
            </label>
            <input
              id="create-user-confirm-password"
              type="password"
              value={values.confirmPassword}
              onChange={(event) =>
                update("confirmPassword", event.target.value)
              }
              placeholder="Re-enter the password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={
                errors.confirmPassword
                  ? "create-user-confirm-password-error"
                  : undefined
              }
            />
            {errors.confirmPassword ? (
              <span
                className={styles.error}
                id="create-user-confirm-password-error"
                role="alert"
              >
                {errors.confirmPassword}
              </span>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="create-user-role">Select Role</label>
            <select
              id="create-user-role"
              value={values.role}
              onChange={(event) => update("role", event.target.value)}
              aria-invalid={errors.role ? true : undefined}
              aria-describedby={
                errors.role ? "create-user-role-error" : undefined
              }
            >
              <option value="">Select Role</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.role ? (
              <span
                className={styles.error}
                id="create-user-role-error"
                role="alert"
              >
                {errors.role}
              </span>
            ) : null}
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
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
