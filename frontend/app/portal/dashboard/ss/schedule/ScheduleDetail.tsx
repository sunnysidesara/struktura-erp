"use client";

import { useState } from "react";
import { Tabs } from "@/app/portal/dashboard/sa/_components/SaPage";
import type { SsSiteOption } from "@/lib/api";
import { ScheduleView } from "../_components/ScheduleView";
import { SsDetailModal } from "../_components/SsDetailModal";

type Scope = "today" | "week" | "all";

const TABS: { id: Scope; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "all", label: "All" },
];

export function ScheduleDetail({ site, onClose }: { site: SsSiteOption; onClose: () => void }) {
  const [scope, setScope] = useState<Scope>("today");

  return (
    <SsDetailModal page="Schedule" site={site} onClose={onClose}>
      <Tabs items={TABS} active={scope} onChange={setScope} label="Schedule ranges" />
      <ScheduleView key={scope} mode={scope} projectId={site.project_id} />
    </SsDetailModal>
  );
}
