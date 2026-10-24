"use client";

import { useState } from "react";
import type { SsSiteOption } from "@/lib/api";
import { SiteMaster } from "../_components/SiteMaster";
import { WorkersDetail } from "./WorkersDetail";

export default function WorkerRosterPage() {
  const [openSite, setOpenSite] = useState<SsSiteOption | null>(null);

  return (
    <>
      <SiteMaster
        kicker="Site Supervisor"
        title="Workers"
        subtitle="Choose a site to view its worker roster"
        actionLabel="View Workers"
        onOpen={setOpenSite}
      />

      {openSite ? <WorkersDetail site={openSite} onClose={() => setOpenSite(null)} /> : null}
    </>
  );
}
