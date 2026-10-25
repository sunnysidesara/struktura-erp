"use client";

import { useEffect, useState } from "react";
import {
  getSsSchedule,
  updateSsTaskStatus,
  type SsScheduleResponse,
  type SsTask,
} from "@/lib/api";
import {
  MetricCard,
  MetricGrid,
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  Tabs,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { SsSiteGate } from "../_components/SsSiteGate";
import { useSsSite } from "../_components/siteSelection";
import ssStyles from "../ss.module.css";

type ScheduleScope = "today" | "week" | "all";

const TABS: { id: ScheduleScope; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "all", label: "All" },
];

const baseColumns: SaColumn<SsTask>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "time", label: "Time", render: (row) => row.time || "-" },
  { key: "task", label: "Task", render: (row) => row.title },
  { key: "phase", label: "Phase", render: (row) => row.phase },
  { key: "worker", label: "Worker", render: (row) => row.assignee },
  {
    key: "status",
    label: "Status",
    status: true,
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export default function SchedulePage() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Site Supervisor"
      title="Work Schedule"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Scheduled tasks for the site selected in My Sites."
      }
    >
      <SsSiteGate>{(projectId) => <ScheduleDetail projectId={projectId} />}</SsSiteGate>
    </SaPage>
  );
}

function ScheduleDetail({ projectId }: { projectId: number }) {
  const [scope, setScope] = useState<ScheduleScope>("today");
  const [schedule, setSchedule] = useState<SsScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    setSchedule(null);

    getSsSchedule(scope, projectId)
      .then((response) => {
        if (!active) return;
        setSchedule(response);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load the schedule.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId, scope, refreshKey]);

  const tasks = schedule?.data ?? [];
  const counts = schedule?.counts;

  const handleStatusChange = async (row: SsTask, nextStatus: string) => {
    if (nextStatus === row.status) {
      return;
    }

    setStatusUpdatingId(row.task_id);
    setNotice("");

    try {
      await updateSsTaskStatus(row.task_id, nextStatus);
      setNotice(`"${row.title}" moved to ${nextStatus}.`);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update the task status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const columns: SaColumn<SsTask>[] = [
    ...baseColumns,
    {
      key: "actions",
      label: "Action",
      render: (row) => {
        if (row.status === "Pending") {
          return (
            <button
              type="button"
              className={ssStyles.statusButton}
              onClick={() => handleStatusChange(row, "In Progress")}
              disabled={statusUpdatingId !== null}
            >
              {statusUpdatingId === row.task_id ? "Starting..." : "Start Task"}
            </button>
          );
        }

        if (row.status === "In Progress") {
          return (
            <button
              type="button"
              className={ssStyles.statusButton}
              onClick={() => handleStatusChange(row, "Done")}
              disabled={statusUpdatingId !== null}
            >
              {statusUpdatingId === row.task_id ? "Saving..." : "Mark Done"}
            </button>
          );
        }

        return <span className={ssStyles.statusComplete}>Done</span>;
      },
    },
  ];

  return (
    <>
      {notice ? <p className={ssStyles.notice}>{notice}</p> : null}

      <Tabs items={TABS} active={scope} onChange={setScope} label="Schedule ranges" />

      <MetricGrid>
        <MetricCard
          label="Total Tasks"
          value={loading ? "..." : (counts?.total ?? 0)}
          note="In the selected range"
        />
        <MetricCard
          label="Done"
          value={loading ? "..." : (counts?.done ?? 0)}
          note="Completed tasks"
        />
        <MetricCard
          label="In Progress"
          value={loading ? "..." : (counts?.in_progress ?? 0)}
          note="Currently underway"
        />
        <MetricCard
          label="Pending"
          value={loading ? "..." : (counts?.pending ?? 0)}
          note="Not started yet"
        />
      </MetricGrid>

      <SaPanel title={`Tasks (${tasks.length})`}>
        <SaTable
          columns={columns}
          rows={tasks}
          loading={loading}
          error={error}
          emptyText="No tasks are scheduled for this site in this range."
          rowKey={(row) => row.task_id}
        />
      </SaPanel>
    </>
  );
}
