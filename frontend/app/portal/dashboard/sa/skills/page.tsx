"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteSkill, listSkills, type ApiSkill } from "@/lib/api";
import { confirmDelete } from "@/lib/confirmDelete";
import {
  SaPage,
  SaPanel,
  SaTable,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { SkillModal } from "./SkillModal";
import styles from "../page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

const UNCATEGORIZED = "__none";

export default function SkillsPage() {
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [notice, setNotice] = useState<Notice>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiSkill | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listSkills()
      .then((data) => {
        setSkills(data);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load skills."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Real categories present in the database, used by the filter + modal.
  const existingCategories = useMemo(
    () =>
      Array.from(
        new Set(
          skills
            .map((skill) => skill.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [skills],
  );

  const hasUncategorized = skills.some((skill) => !skill.category);

  const filtered = skills.filter((skill) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || skill.skill_name.toLowerCase().includes(term);
    const matchesCategory =
      categoryFilter === "all"
        ? true
        : categoryFilter === UNCATEGORIZED
          ? !skill.category
          : skill.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (skill: ApiSkill) => {
    setEditing(skill);
    setModalOpen(true);
  };

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setEditing(null);
    setNotice({ type: "success", message });
    load();
  };

  const remove = async (skill: ApiSkill) => {
    if (!confirmDelete(`Delete skill "${skill.skill_name}"?`)) {
      return;
    }

    setNotice(null);

    try {
      await deleteSkill(skill.skill_id);
      setNotice({ type: "success", message: `"${skill.skill_name}" deleted.` });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Delete failed.",
      });
    }
  };

  const columns: SaColumn<ApiSkill>[] = [
    { key: "name", label: "Skill", render: (row) => row.skill_name },
    {
      key: "category",
      label: "Category",
      render: (row) => row.category ?? "Uncategorized",
    },
    { key: "desc", label: "Description", render: (row) => row.description ?? "-" },
    {
      key: "laborers",
      label: "Qualified Laborers",
      render: (row) => row.laborer_count ?? 0,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => openEdit(row)}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => remove(row)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <SaPage
      kicker="Reference Data"
      title="Skills"
      subtitle="Trades and qualifications used across projects"
    >
      {notice ? (
        <p className={notice.type === "error" ? styles.alert : styles.muted}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel
        title={`Skill Catalog (${filtered.length})`}
        filters={
          <>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              aria-label="Search skills by name"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter skills by category"
            >
              <option value="all">All Categories</option>
              {existingCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              {hasUncategorized ? (
                <option value={UNCATEGORIZED}>Uncategorized</option>
              ) : null}
            </select>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={openCreate}
            >
              + Add Skill
            </button>
          </>
        }
      >
        <SaTable
          columns={columns}
          rows={filtered}
          loading={loading}
          error={error}
          emptyText={
            skills.length === 0
              ? "No skills defined yet. Use + Add Skill to create one."
              : "No skills match your search or filter."
          }
          rowKey={(row) => row.skill_id}
        />
      </SaPanel>

      <SkillModal
        open={modalOpen}
        skill={editing}
        categories={existingCategories}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </SaPage>
  );
}
