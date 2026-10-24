"use client";

import { useState } from "react";
import type { SsSiteOption } from "@/lib/api";
import { SiteMaster } from "../_components/SiteMaster";
import { LogsDetail } from "./LogsDetail";

export default function DailyLogsPage() {
  const [openSite, setOpenSite] = useState<SsSiteOption | null>(null);

  return (
    <>
      <SiteMaster
        kicker="Site Supervisor"
        title="Daily Logs"
        subtitle="Choose a site to log hours, materials and equipment"
        actionLabel="Open Logs"
        onOpen={setOpenSite}
      />

      {openSite ? <LogsDetail site={openSite} onClose={() => setOpenSite(null)} /> : null}
    </>
  );
}
