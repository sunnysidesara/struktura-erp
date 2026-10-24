"use client";

import { useState } from "react";
import type { SsSiteOption } from "@/lib/api";
import { SiteMaster } from "../_components/SiteMaster";
import { ScheduleDetail } from "./ScheduleDetail";

export default function SchedulePage() {
  const [openSite, setOpenSite] = useState<SsSiteOption | null>(null);

  return (
    <>
      <SiteMaster
        kicker="Site Supervisor"
        title="Schedule"
        subtitle="Choose a site to see its task schedule"
        actionLabel="View Schedule"
        onOpen={setOpenSite}
      />

      {openSite ? <ScheduleDetail site={openSite} onClose={() => setOpenSite(null)} /> : null}
    </>
  );
}
