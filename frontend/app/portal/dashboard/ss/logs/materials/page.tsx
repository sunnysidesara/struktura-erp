"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { SsSiteGate } from "../../_components/SsSiteGate";
import { useSsSite } from "../../_components/siteSelection";
import { MaterialsTab } from "../MaterialsTab";

export default function MaterialsLogPage() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Daily Logs"
      title="Materials Log"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Record material usage for the site selected in My Sites."
      }
    >
      <SsSiteGate>{(projectId) => <MaterialsTab projectId={projectId} />}</SsSiteGate>
    </SaPage>
  );
}
