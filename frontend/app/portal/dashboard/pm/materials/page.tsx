"use client";

import { useState } from "react";
import { SaPage, Tabs } from "@/app/portal/dashboard/sa/_components/SaPage";
import { CataloguePanel } from "../_components/CataloguePanel";
import { PmProjectGate } from "../_components/PmProjectGate";
import { usePmProject } from "../_components/projectSelection";
import { UsagePanel } from "../_components/UsageDetail";

type ResourceTab = "usage" | "catalogue";

const TABS: { id: ResourceTab; label: string }[] = [
  { id: "usage", label: "Usage" },
  { id: "catalogue", label: "Catalogue" },
];

export default function MaterialsPage() {
  const { selected } = usePmProject();
  const [tab, setTab] = useState<ResourceTab>("usage");

  return (
    <SaPage
      kicker="Resources"
      title="Materials"
      subtitle={
        selected
          ? `${selected.code} · ${selected.project_name}`
          : "Select a project to review its material usage and catalogue."
      }
    >
      <PmProjectGate>
        {(projectId) => (
          <>
            <Tabs
              items={TABS}
              active={tab}
              onChange={setTab}
              label="Material views"
            />

            {tab === "usage" ? (
              <UsagePanel projectId={projectId} kind="material" />
            ) : (
              <CataloguePanel kind="material" />
            )}
          </>
        )}
      </PmProjectGate>
    </SaPage>
  );
}
