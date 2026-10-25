"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ApiError,
  createEquipment,
  createMaterial,
  updateEquipment,
  updateMaterial,
  type ApiEquipment,
  type ApiMaterial,
} from "@/lib/api";
import styles from "../users/CreateUserModal.module.css";

type Kind = "material" | "equipment";
type Values = {
  name: string;
  unit: string;
  type: string;
  cost: string;
  stock: string;
};
type FieldErrors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = {
  name: "",
  unit: "",
  type: "",
  cost: "",
  stock: "",
};

export function CatalogueModal({
  open,
  kind,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: Kind;
  item: ApiMaterial | ApiEquipment | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isMaterial = kind === "material";
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const material = isMaterial ? (item as ApiMaterial | null) : null;
    const equipment = !isMaterial ? (item as ApiEquipment | null) : null;

    setValues({
      name: material?.material_name ?? equipment?.equipment_name ?? "",
      unit: material?.unit_of_measure ?? "",
      type: equipment?.equipment_type ?? "",
      cost: String(material?.unit_cost ?? equipment?.hourly_rental_rate ?? ""),
      stock: material ? String(material.stock_quantity) : "",
    });
    setErrors({});
    setFormError("");
    setSaving(false);
  }, [open, isMaterial, item]);

  const update = (key: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError("");

    const name = values.name.trim();
    const cost = Number(values.cost);
    const stock = Number(values.stock);

    if (!name) {
      setErrors({ name: `Enter the ${isMaterial ? "material" : "equipment"} name.` });
      return;
    }

    if (!Number.isFinite(cost) || cost < 0) {
      setErrors({ cost: "Enter a valid non-negative amount." });
      return;
    }

    if (isMaterial && (!Number.isInteger(stock) || stock < 0)) {
      setErrors({ stock: "Stock must be a whole number of zero or more." });
      return;
    }

    setSaving(true);

    try {
      const result = isMaterial
        ? item
          ? await updateMaterial((item as ApiMaterial).material_id, {
              material_name: name,
              unit_of_measure: values.unit.trim() || null,
              unit_cost: cost,
              stock_quantity: stock,
            })
          : await createMaterial({
              material_name: name,
              unit_of_measure: values.unit.trim() || null,
              unit_cost: cost,
              stock_quantity: stock,
            })
        : item
          ? await updateEquipment((item as ApiEquipment).equipment_id, {
              equipment_name: name,
              equipment_type: values.type.trim() || null,
              hourly_rental_rate: cost,
            })
          : await createEquipment({
              equipment_name: name,
              equipment_type: values.type.trim() || null,
              hourly_rental_rate: cost,
            });

      onSaved(result.message);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const first = (key: string) => err.errors?.[key]?.[0];

        if (first("material_name") || first("equipment_name")) {
          setErrors({ name: first("material_name") ?? first("equipment_name") });
          return;
        }
        if (first("unit_of_measure")) {
          setErrors({ unit: first("unit_of_measure") });
          return;
        }
        if (first("unit_cost") || first("hourly_rental_rate")) {
          setErrors({ cost: first("unit_cost") ?? first("hourly_rental_rate") });
          return;
        }
        if (first("stock_quantity")) {
          setErrors({ stock: first("stock_quantity") });
          return;
        }
        if (first("equipment_type")) {
          setErrors({ type: first("equipment_type") });
          return;
        }
      }

      setFormError(
        err instanceof Error ? err.message : "Could not save the catalogue record.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return null;
  }

  const title = isMaterial ? "Material" : "Equipment";

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="catalogue-modal-title">
        <header className={styles.modalHead}>
          <div>
            <p className={styles.kicker}>Resources</p>
            <h2 className={styles.title} id="catalogue-modal-title">
              {item ? `Edit ${title}` : `New ${title}`}
            </h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close dialog">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <form className={styles.form} onSubmit={submit} noValidate>
          {formError ? (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="catalogue-name">{title} Name</label>
            <input
              id="catalogue-name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder={`Enter ${title.toLowerCase()} name`}
              autoFocus
            />
            {errors.name ? <span className={styles.error}>{errors.name}</span> : null}
          </div>

          {isMaterial ? (
            <>
              <div className={styles.field}>
                <label htmlFor="catalogue-unit">Unit</label>
                <input
                  id="catalogue-unit"
                  value={values.unit}
                  onChange={(event) => update("unit", event.target.value)}
                  placeholder="e.g. bags, pieces, cubic meter"
                />
                {errors.unit ? <span className={styles.error}>{errors.unit}</span> : null}
              </div>

              <div className={styles.field}>
                <label htmlFor="catalogue-stock">Stock Quantity</label>
                <input
                  id="catalogue-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={values.stock}
                  onChange={(event) => update("stock", event.target.value)}
                  placeholder="0"
                />
                {errors.stock ? <span className={styles.error}>{errors.stock}</span> : null}
              </div>
            </>
          ) : (
            <>
              <div className={styles.field}>
                <label htmlFor="catalogue-type">Type</label>
                <input
                  id="catalogue-type"
                  value={values.type}
                  onChange={(event) => update("type", event.target.value)}
                  placeholder="e.g. Excavator, Truck"
                />
                {errors.type ? <span className={styles.error}>{errors.type}</span> : null}
              </div>

            </>
          )}

          <div className={styles.field}>
            <label htmlFor="catalogue-cost">
              {isMaterial ? "Unit Cost" : "Hourly Rental Rate"}
            </label>
            <input
              id="catalogue-cost"
              type="number"
              min="0"
              step="0.01"
              value={values.cost}
              onChange={(event) => update("cost", event.target.value)}
              placeholder="0.00"
            />
            {errors.cost ? <span className={styles.error}>{errors.cost}</span> : null}
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
              {saving ? "Saving..." : item ? "Save Changes" : `Create ${title}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

