"use client";

import { useState } from "react";
import type { SsSiteOption } from "@/lib/api";
import { SiteMaster } from "../_components/SiteMaster";
import { PhasesDetail } from "./PhasesDetail";

export default function ActivePhasesPage() {
  const [openSite, setOpenSite] = useState<SsSiteOption | null>(null);

  return (
    <>
      <SiteMaster
        kicker="Site Supervisor"
        title="Phases"
        subtitle="Choose a site to view its phases"
        actionLabel="View Phases"
        onOpen={setOpenSite}
      />

      {openSite ? <PhasesDetail site={openSite} onClose={() => setOpenSite(null)} /> : null}
    </>
  );
}
