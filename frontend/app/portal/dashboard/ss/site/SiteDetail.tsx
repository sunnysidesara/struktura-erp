"use client";

import { useState } from "react";
import { getSsSite, getSsSiteInfo, type SsPhase, type SsSite, type SsSiteOption } from "@/lib/api";
import {
  MetricCard,
  MetricGrid,
  SaPanel,
  SaTable,
  StatusBadge,
  Tabs,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { ProgressBar } from "../_components/SsReport";
import { useSsResource } from "../_components/useSsResource";
import { SsDetailModal } from "../_components/SsDetailModal";
import ssStyles from "../ss.module.css";

type TabId = "overview" | "info" | "map";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "info", label: "Site Info" },
  { id: "map", label: "Map" },
];

const phaseColumns: SaColumn<SsPhase>[] = [
  { key: "name", label: "Phase", render: (row) => `${row.sequence}. ${row.name}` },
  {
    key: "planned",
    label: "Planned",
    render: (row) => `${row.plannedStart ?? "-"} → ${row.plannedEnd ?? "-"}`,
  },
  { key: "progress", label: "Progress", render: (row) => <ProgressBar value={row.progress} /> },
  { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
];

const notes = [
  "All material deliveries must be recorded on the day they arrive.",
  "Labor hours must be submitted before the end of each shift.",
  "Report equipment breakdowns to the Project Manager immediately.",
  "Keep the site access log updated for every visitor.",
];

export function SiteDetail({ site: siteRow, onClose }: { site: SsSiteOption; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("overview");
  const summary = useSsResource(() => getSsSite(siteRow.project_id), siteRow.project_id);
  const info = useSsResource(() => getSsSiteInfo(siteRow.project_id), siteRow.project_id);

  const site = summary.data?.site ?? info.data?.site ?? null;
  const metrics = summary.data?.metrics;

  return (
    <SsDetailModal page="My Site" site={siteRow} onClose={onClose}>
      <Tabs items={TABS} active={tab} onChange={setTab} label="Site views" />

      {tab === "overview" ? (
        <>
          {summary.loading ? <p className={ssStyles.muted}>Loading site summary...</p> : null}

          {summary.error !== "" ? <p className={ssStyles.noticeError}>{summary.error}</p> : null}

          {!summary.loading && summary.error === "" && !site ? (
            <p className={ssStyles.notice}>No project is assigned to this account yet.</p>
          ) : null}

          {site ? (
            <>
              <section
                style={{
                  background: "linear-gradient(135deg, #0a1440 0%, #14245c 100%)",
                  borderRadius: "10px",
                  padding: "1.5rem",
                  color: "#ffffff",
                  marginBottom: "1.25rem",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ca8a04" }}>
                  Assigned Site
                </p>
                <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.45rem", fontWeight: 800 }}>{site.project}</h2>
                <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: "#c7d2fe" }}>
                  {site.location ?? "-"} &middot; Client: {site.client ?? "-"}
                </p>
              </section>

              <MetricGrid>
                <MetricCard label="Overall Progress" value={`${metrics?.overall_progress ?? 0}%`} note="Average across phases" />
                <MetricCard label="Phases Complete" value={`${metrics?.completed_phases ?? 0}/${metrics?.total_phases ?? 0}`} note="Completed phases" />
                <MetricCard label="Days Remaining" value={String(metrics?.days_remaining ?? 0)} note={`Until ${site.endDate ?? "-"}`} />
                <MetricCard label="Active Workers" value={String(metrics?.active_workers ?? 0)} note={`${metrics?.total_workers ?? 0} on roster`} />
              </MetricGrid>

              <SaPanel title="Phase timeline">
                <SaTable
                  columns={phaseColumns}
                  rows={summary.data?.phases ?? []}
                  rowKey={(row) => row.id}
                  emptyText="No phases defined yet."
                />
              </SaPanel>
            </>
          ) : null}
        </>
      ) : null}

      {tab === "info" ? <SiteInfoTab site={site} loading={info.loading} error={info.error} /> : null}

      {tab === "map" ? <SiteMapTab site={site} loading={info.loading} error={info.error} /> : null}
    </SsDetailModal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
        {label}
      </div>
      <div style={{ marginTop: "0.25rem", fontSize: "0.9rem", fontWeight: 600, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function SiteInfoTab({
  site,
  loading,
  error,
}: {
  site: SsSite | null;
  loading: boolean;
  error: string;
}) {
  return (
    <>
      <SaPanel title="Project details">
        {site ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1.25rem 2rem" }}>
            <Row label="Project" value={site.project} />
            <Row label="Project Code" value={site.code} />
            <Row label="Client" value={site.client ?? "-"} />
            <Row label="Location" value={site.location ?? "-"} />
            <Row label="Site Supervisor" value={site.supervisor || "-"} />
            <Row label="Project Manager" value={site.manager || "-"} />
            <Row label="Start Date" value={site.startDate ?? "-"} />
            <Row label="Target Completion" value={site.endDate ?? "-"} />
            <Row label="Current Phase" value={site.currentPhase ?? "Not started"} />
            <Row
              label="Coordinates"
              value={
                site.coordinates.lat !== null && site.coordinates.lng !== null
                  ? `${site.coordinates.lat}, ${site.coordinates.lng}`
                  : "Not set"
              }
            />
          </div>
        ) : (
          <p className={loading ? ssStyles.muted : ssStyles.noticeError}>
            {loading
              ? "Loading site information..."
              : error !== ""
                ? error
                : "No project is assigned to this account yet."}
          </p>
        )}
      </SaPanel>

      <SaPanel title="Site notes">
        <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.6rem", fontSize: "0.86rem", color: "#334155" }}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </SaPanel>

      <SaPanel title="Access limitations">
        <p style={{ margin: 0, fontSize: "0.86rem", color: "#334155" }}>
          As a Site Supervisor you can record daily labor, material, and equipment usage for this
          site. Budgets, master records, and system configuration are read-only and managed by the
          Administrator and Project Manager.
        </p>
      </SaPanel>
    </>
  );
}

function SiteMapTab({
  site,
  loading,
  error,
}: {
  site: SsSite | null;
  loading: boolean;
  error: string;
}) {
  const lat = site?.coordinates.lat ?? null;
  const lng = site?.coordinates.lng ?? null;
  const hasCoordinates = lat !== null && lng !== null;
  const mapsUrl = hasCoordinates ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <SaPanel title="Location">
      {hasCoordinates ? (
        <div>
          <div
            style={{
              position: "relative",
              height: "420px",
              borderRadius: "10px",
              border: "1px solid #d1d9e6",
              overflow: "hidden",
              background:
                "repeating-linear-gradient(0deg, #e6ebf2 0 1px, transparent 1px 44px), repeating-linear-gradient(90deg, #e6ebf2 0 1px, transparent 1px 44px), linear-gradient(135deg, #f1f5f9, #e2e8f0)",
            }}
          >
            <div style={{ position: "absolute", left: "-10%", right: "-10%", top: "54%", height: "30px", background: "#cbd5e1", transform: "rotate(-7deg)" }} />
            <div style={{ position: "absolute", top: "-10%", bottom: "-10%", left: "45%", width: "22px", background: "#cbd5e1", transform: "rotate(5deg)" }} />
            <div
              style={{
                position: "absolute",
                left: "45%",
                top: "50%",
                width: "18px",
                height: "18px",
                borderRadius: "50% 50% 50% 0",
                background: "#ca8a04",
                transform: "translate(-50%, -100%) rotate(-45deg)",
                boxShadow: "0 0 0 8px rgba(202, 138, 4, 0.18)",
              }}
            />
            <div style={{ position: "absolute", left: "47%", top: "52%", background: "#0a1440", color: "#ffffff", padding: "0.4rem 0.7rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700 }}>
              {site?.project}
            </div>
            <div style={{ position: "absolute", left: "1rem", bottom: "1rem", background: "rgba(255, 255, 255, 0.9)", border: "1px solid #d1d9e6", borderRadius: "6px", padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "#334155" }}>
              Illustrative map - no external map service connected.
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between", marginTop: "1rem" }}>
            <div style={{ fontSize: "0.85rem", color: "#334155" }}>
              <strong>{site?.location ?? "-"}</strong> &middot; {lat}, {lng}
            </div>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0a1440" }}>
                Open in Google Maps
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <p className={ssStyles.muted}>
          {loading
            ? "Loading site location..."
            : error !== ""
              ? error
              : "No coordinates have been recorded for this site yet."}
        </p>
      )}
    </SaPanel>
  );
}
