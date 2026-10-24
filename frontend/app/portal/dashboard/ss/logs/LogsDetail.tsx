"use client";

import { useState } from "react";
import { Tabs } from "@/app/portal/dashboard/sa/_components/SaPage";
import type { SsSiteOption } from "@/lib/api";
import { SsDetailModal } from "../_components/SsDetailModal";
import { EquipmentTab } from "./EquipmentTab";
import { LaborTab } from "./LaborTab";
import { MaterialsTab } from "./MaterialsTab";

type TabId = "labor" | "materials" | "equipment";

const TABS: { id: TabId; label: string }[] = [
  { id: "labor", label: "Log Hours" },
  { id: "materials", label: "Materials" },
  { id: "equipment", label: "Equipment" },
];

export function LogsDetail({ site, onClose }: { site: SsSiteOption; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("labor");

  return (
    <SsDetailModal page="Daily Logs" site={site} onClose={onClose}>
      <Tabs items={TABS} active={tab} onChange={setTab} label="Daily log types" />

      {tab === "labor" ? <LaborTab projectId={site.project_id} /> : null}
      {tab === "materials" ? <MaterialsTab projectId={site.project_id} /> : null}
      {tab === "equipment" ? <EquipmentTab projectId={site.project_id} /> : null}
    </SsDetailModal>
  );
}
