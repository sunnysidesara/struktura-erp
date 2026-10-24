"use client";

import { useState } from "react";
import { getSsSchedule, type SsTask } from "@/lib/api";
import {
  MetricCard,
  MetricGrid,
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { useSsResource } from "./useSsResource";

const columns: SaColumn<SsTask>[] = [
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "title", label: "Task", render: (row) => row.title },
  { key: "assignee", label: "Assignee", render: (row) => row.assignee },
  { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
];

/**
 * Task list for one schedule scope (today / week / all) on the selected site.
 * The page owns the heading + tabs.
 */
export function ScheduleView({
  mode,
  projectId,
}: {
  mode: "today" | "week" | "all";
  projectId?: number | null;
}) {
  const { data, loading, error } = useSsResource(
    () => getSsSchedule(mode, projectId),
    projectId,
  );
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const rows = (data?.data ?? []).filter((task) => {
    const matchesStatus = status === "all" || task.status === status;
    const matchesQuery =
      q === "" ||
      [task.title, task.phase, task.assignee, task.date].some((value) =>
        value.toLowerCase().includes(q),
      );

    return matchesStatus && matchesQuery;
  });

  return (
    <>
      <MetricGrid>
        <MetricCard label="Tasks" value={String(data?.counts.total ?? 0)} note={`As of ${data?.server_date ?? "-"}`} />
        <MetricCard label="Done" value={String(data?.counts.done ?? 0)} note="Completed" />
        <MetricCard label="In Progress" value={String(data?.counts.in_progress ?? 0)} note="Ongoing now" />
        <MetricCard label="Pending" value={String(data?.counts.pending ?? 0)} note="Not started" />
      </MetricGrid>

      <SaPanel
        title="Task list"
        filters={
          <>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search..." />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="Done">Done</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending</option>
            </select>
          </>
        }
      >
        <SaTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          rowKey={(row) => row.id}
          emptyText="No tasks match the current filters."
        />
      </SaPanel>
    </>
  );
}
