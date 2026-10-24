"use client";

import { SaPage } from "@/app/portal/dashboard/sa/_components/SaPage";
import { SsSiteGate } from "../_components/SsSiteGate";
import { useSsSite } from "../_components/siteSelection";
import { SiteDetail } from "./SiteDetail";

export default function CurrentSiteDetailsPage() {
  const { selected } = useSsSite();

  return (
    <SaPage
      kicker="Site Supervisor"
      title="Current Site Details"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project}`
          : "Project details for the site selected in My Sites."
      }
    >
      <SsSiteGate>{() => <SiteDetail />}</SsSiteGate>
    </SaPage>
  );
}
