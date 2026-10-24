"use client";

import { useState } from "react";
import type { SsSiteOption } from "@/lib/api";
import { SiteMaster } from "../_components/SiteMaster";
import { SiteDetail } from "./SiteDetail";

export default function SsSitePage() {
  const [openSite, setOpenSite] = useState<SsSiteOption | null>(null);

  return (
    <>
      <SiteMaster
        kicker="Site Supervisor"
        title="My Site"
        subtitle="Choose one of your sites to see its details"
        actionLabel="View Site"
        onOpen={setOpenSite}
      />

      {openSite ? <SiteDetail site={openSite} onClose={() => setOpenSite(null)} /> : null}
    </>
  );
}
