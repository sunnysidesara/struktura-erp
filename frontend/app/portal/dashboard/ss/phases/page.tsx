"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { SsSiteGate } from "../_components/SsSiteGate";
import { useSsSite } from "../_components/siteSelection";
import { PhasesDetail } from "./PhasesDetail";

export default function PhasesPage() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Site Supervisor"
      title="Phases"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Phases for the site selected in My Sites."
      }
    >
      <SsSiteGate>{() => <PhasesDetail />}</SsSiteGate>
    </SaPage>
  );
}
