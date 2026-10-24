"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { SsSiteGate } from "../../_components/SsSiteGate";
import { useSsSite } from "../../_components/siteSelection";
import { LaborTab } from "../LaborTab";

export default function WorkersLogPage() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Daily Logs"
      title="Workers Log"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Record worker attendance for the site selected in My Sites."
      }
    >
      <SsSiteGate>{(projectId) => <LaborTab projectId={projectId} />}</SsSiteGate>
    </SaPage>
  );
}
