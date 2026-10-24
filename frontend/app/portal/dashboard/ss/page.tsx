"use client";

import { useRouter } from "next/navigation";
import type { SsSiteOption } from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  StatusBadge,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import { ProgressBar } from "./_components/SsReport";
import { selectSsSite, useSsSite } from "./_components/siteSelection";
import styles from "../sa/page.module.css";
import ssStyles from "./ss.module.css";

export default function SiteSupervisorOverview() {
  const router = useRouter();
  const { sites, selected, loading, error } = useSsSite();

  const openSite = (site: SsSiteOption) => {
    selectSsSite(site.project_id);
    router.push("/portal/dashboard/ss/site");
  };

  const columns: SaColumn<SsSiteOption>[] = [
    { key: "code", label: "Site ID", render: (row) => row.code },
    { key: "project", label: "Site", render: (row) => row.project },
    { key: "progress", label: "Progress", render: (row) => <ProgressBar value={row.progress} /> },
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
          <button type="button" className={styles.linkButton} onClick={() => openSite(row)}>
            Open
          </button>
        </div>
      ),
    },
  ];

  return (
    <SaPage
      kicker="Site Supervisor"
      title="Overview"
      subtitle={
        selected
          ? `Selected site: ${selected.code} · ${selected.project} (${selected.progress}% complete)`
          : "Every site assigned to you with its current progress."
      }
    >
      <SaPanel title="Welcome">
        <div className={ssStyles.welcomeBody}>
          <p className={ssStyles.welcomeHead}>Welcome back to your sites.</p>
          <p className={ssStyles.welcomeText}>
            Open one of your assigned sites below, or pick one from &ldquo;My Sites&rdquo; in the
            header. Once a site is selected, the sidebar unlocks so you can review its details,
            phases and daily logs.
          </p>
        </div>
      </SaPanel>

      <SaPanel title={`My Sites (${sites.length})`}>
        <SaTable
          columns={columns}
          rows={sites}
          loading={loading}
          error={error}
          emptyText="No site is assigned to this account yet. Ask your Project Manager to add you to a project."
          rowKey={(row) => row.project_id}
        />
      </SaPanel>
    </SaPage>
  );
}
