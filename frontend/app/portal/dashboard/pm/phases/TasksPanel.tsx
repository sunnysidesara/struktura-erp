"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePmTask,
  getPmWorkforce,
  listPmTasks,
  type PmLaborer,
  type PmPhase,
  type PmProject,
  type PmTask,
} from "@/lib/api";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { TaskModal } from "./TaskModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

export function TasksPanel({
  project,
  phases,
}: {
  project: PmProject;
  phases: PmPhase[];
}) {
  const [tasks, setTasks] = useState<PmTask[]>([]);
  const [workers, setWorkers] = useState<PmLaborer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PmTask | null>(null);

  const load = useCallback(() => {
    setLoading(true);

    Promise.all([listPmTasks(project.project_id), getPmWorkforce(project.project_id)])
      .then(([taskList, workforce]) => {
        setTasks(taskList);
        setWorkers(workforce.assigned);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load site tasks."),
      )
      .finally(() => setLoading(false));
  }, [project.project_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setEditing(null);
    setNotice({ type: "success", message });
    load();
  };

  const handleDelete = async (task: PmTask) => {
    if (!window.confirm(`Delete the task "${task.title}"?`)) {
      return;
    }

    try {
      await deletePmTask(task.task_id);
      setNotice({ type: "success", message: "Task deleted." });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not delete the task.",
      });
    }
  };

  const columns: SaColumn<PmTask>[] = [
    { key: "date", label: "Date", render: (row) => row.date },
    { key: "time", label: "Time", render: (row) => row.time || "-" },
    { key: "title", label: "Task", render: (row) => row.title },
    { key: "phase", label: "Phase", render: (row) => row.phase || "-" },
    { key: "assignee", label: "Worker", render: (row) => row.assignee },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setEditing(row);
              setModalOpen(true);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.linkButtonAlt}
            onClick={() => handleDelete(row)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {notice ? (
        <p className={notice.type === "error" ? pmStyles.noticeError : pmStyles.notice}>
          {notice.message}
        </p>
      ) : null}

      <SaPanel
        title={`Site Tasks (${tasks.length})`}
        filters={
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + Add Task
          </button>
        }
      >
        <SaTable
          columns={columns}
          rows={tasks}
          loading={loading}
          error={error}
          emptyText="No tasks are scheduled for this project yet."
          rowKey={(row) => row.task_id}
        />
      </SaPanel>

      <TaskModal
        open={modalOpen}
        task={editing}
        project={project}
        phases={phases}
        workers={workers}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
    </>
  );
}
