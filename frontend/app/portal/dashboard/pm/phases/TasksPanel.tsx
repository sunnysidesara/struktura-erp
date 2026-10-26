"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deletePmTask,
  getPmWorkforce,
  listPmTasks,
  updatePmTaskStatus,
  type PmLaborer,
  type PmPhase,
  type PmProject,
  type PmTask,
} from "@/lib/api";
import { confirmDelete } from "@/lib/confirmDelete";
import {
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
  type SaSortState,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { TaskModal } from "./TaskModal";
import styles from "../../sa/page.module.css";
import pmStyles from "../page.module.css";

type Notice = { type: "success" | "error"; message: string } | null;

type TaskStatus = "Pending" | "In Progress" | "Done";

type TaskStatusAction = {
  label: TaskStatus;
  next: TaskStatus;
  disabled: boolean;
};

const TASK_STATUSES: TaskStatus[] = ["Pending", "In Progress", "Done"];

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
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [sort, setSort] = useState<SaSortState>(null);
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

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

  const phaseNames = useMemo(
    () =>
      Array.from(
        new Set(
          phases
            .map((phase) => phase.phase_name)
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [phases],
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          phaseFilter === "all" || (task.phase ?? "") === phaseFilter,
      ),
    [phaseFilter, tasks],
  );

  const sortedTasks = useMemo(() => {
    if (!sort) return visibleTasks;

    const direction = sort.direction === "asc" ? 1 : -1;
    const valueFor = (task: PmTask) => {
      switch (sort.key) {
        case "date":
          return task.date;
        case "time":
          return task.time;
        case "title":
          return task.title;
        case "phase":
          return task.phase ?? "";
        case "assignee":
          return task.assignee;
        case "status":
          return task.status;
        default:
          return "";
      }
    };

    return [...visibleTasks].sort(
      (a, b) => direction * valueFor(a).localeCompare(valueFor(b)),
    );
  }, [sort, visibleTasks]);

  const handleStatusChange = async (task: PmTask, next: TaskStatus) => {
    setStatusBusyId(task.task_id);
    setNotice(null);

    try {
      const result = await updatePmTaskStatus(task.task_id, next);
      setNotice({ type: "success", message: result.message });
      load();
    } catch (err) {
      setNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Could not update the task status.",
      });
    } finally {
      setStatusBusyId(null);
    }
  };

  const statusActionsFor = (task: PmTask): TaskStatusAction[] => {
    const phaseStarted = !task.phase_id || task.phase_status === "In Progress";

    return TASK_STATUSES.map((status) => {
      const isCurrent = task.status === status;
      const canMove =
        (task.status === "Pending" && status === "In Progress" && phaseStarted) ||
        (task.status === "In Progress" && status === "Done");

      return {
        label: status,
        next: status,
        disabled: isCurrent || !canMove || statusBusyId !== null,
      };
    });
  };

  const handleSaved = (message: string) => {
    setModalOpen(false);
    setEditing(null);
    setNotice({ type: "success", message });
    load();
  };

  const handleDelete = async (task: PmTask) => {
    if (!confirmDelete(`Delete the task "${task.title}"?`)) {
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
    { key: "date", label: "Date", sortable: true, render: (row) => row.date },
    { key: "time", label: "Time", sortable: true, render: (row) => row.time || "-" },
    { key: "title", label: "Task", sortable: true, render: (row) => row.title },
    { key: "phase", label: "Phase", sortable: true, render: (row) => row.phase || "-" },
    { key: "assignee", label: "Worker", sortable: true, render: (row) => row.assignee },
    {
      key: "status",
      label: "Status",
      status: true,
      sortable: true,
      render: (row) => {
        const actions = statusActionsFor(row);

        return (
          <div className={pmStyles.taskStatusCell}>
            <StatusBadge status={row.status} />
            {actions.length > 0 ? (
              <div className={pmStyles.taskStatusActions}>
                {actions.map((action) => (
                  <div key={action.next} className={pmStyles.taskStatusActionCard}>
                    <button
                      type="button"
                      className={pmStyles.taskStatusButton}
                      onClick={() => handleStatusChange(row, action.next)}
                      disabled={action.disabled}
                    >
                      {statusBusyId === row.task_id ? "Saving..." : action.label}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      },
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
        title={`Site Tasks (${visibleTasks.length})`}
        filters={
          <>
            <select
              value={phaseFilter}
              onChange={(event) => setPhaseFilter(event.target.value)}
              aria-label="Filter site tasks by phase"
            >
              <option value="all">All Phases</option>
              {phaseNames.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
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
          </>
        }
      >
        <SaTable
          columns={columns}
          rows={sortedTasks}
          loading={loading}
          error={error}
          emptyText={
            tasks.length === 0
              ? "No tasks are scheduled for this project yet."
              : "No tasks match this phase filter."
          }
          rowKey={(row) => row.task_id}
          sort={sort}
          onSortChange={setSort}
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
