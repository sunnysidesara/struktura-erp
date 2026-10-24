"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { SsSiteGate } from "../../_components/SsSiteGate";
import { useSsSite } from "../../_components/siteSelection";
import { EquipmentTab } from "../EquipmentTab";

export default function EquipmentLogPage() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Daily Logs"
      title="Equipment Log"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Record equipment hours for the site selected in My Sites."
      }
    >
      <SsSiteGate>{(projectId) => <EquipmentTab projectId={projectId} />}</SsSiteGate>
    </SaPage>
  );
}
