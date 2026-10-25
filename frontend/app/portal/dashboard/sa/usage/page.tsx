"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAdminProjects,
  listPmEquipmentUsage,
  listPmMaterialUsage,
  type ApiProject,
  type PmEquipmentUsageEntry,
  type PmMaterialUsageEntry,
} from "@/lib/api";
import {
  SaPage,
  SaPanel,
  SaTable,
  Tabs,
  useApiData,
  type SaColumn,
} from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../page.module.css";

type UsageTab = "materials" | "equipment";

type UsageData = {
  materials: PmMaterialUsageEntry[];
  equipment: PmEquipmentUsageEntry[];
};

const USAGE_TABS: { id: UsageTab; label: string }[] = [
  { id: "materials", label: "Material Usage" },
  { id: "equipment", label: "Equipment Usage" },
];

/** Admin projects do not return a `code`, so derive the PRJ-#### label. */
const projectCode = (project: ApiProject) =>
  `PRJ-${String(project.project_id).padStart(4, "0")}`;

const materialColumns: SaColumn<PmMaterialUsageEntry>[] = [
  { key: "material", label: "Material", render: (row) => row.material },
  {
    key: "quantity",
    label: "Quantity",
    render: (row) => `${row.quantity} ${row.unit ?? ""}`.trim(),
  },
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "phase", label: "Phase", render: (row) => row.phase },
];

const equipmentColumns: SaColumn<PmEquipmentUsageEntry>[] = [
  { key: "equipment", label: "Equipment", render: (row) => row.equipment },
  { key: "hours", label: "Hours", render: (row) => `${row.hours} h` },
  { key: "date", label: "Date", render: (row) => row.date },
  { key: "phase", label: "Phase", render: (row) => row.phase },
];

export default function AdminUsagePage() {
  const {
    data: projectData,
    loading: projectsLoading,
    error: projectsError,
  } = useApiData(getAdminProjects);
  const projects = useMemo<ApiProject[]>(() => projectData ?? [], [projectData]);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedId === null && projects.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(projects[0].project_id);
    }
  }, [projects, selectedId]);

  const selected =
    projects.find((project) => project.project_id === selectedId) ?? null;

  return (
    <SaPage
      kicker="Operations"
      title="Usage"
      subtitle={
        selected
          ? `${projectCode(selected)} · ${selected.project_name}`
          : "Review material and equipment usage across projects."
      }
    >
      {projectsError ? <p className={styles.alert}>{projectsError}</p> : null}

      <SaPanel
        title="Project"
        filters={
          <select
            value={selectedId ?? ""}
            onChange={(event) =>
              setSelectedId(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            disabled={projectsLoading || projects.length === 0}
            aria-label="Select project"
          >
            {projects.length === 0 ? <option value="">No projects</option> : null}
            {projects.map((project) => (
              <option key={project.project_id} value={project.project_id}>
                {projectCode(project)} - {project.project_name}
              </option>
            ))}
          </select>
        }
      >
        <p className={styles.muted}>
          {selected
            ? `Showing material and equipment usage for ${selected.project_name}.`
            : "Select a project to review its material and equipment usage."}
        </p>
      </SaPanel>

      {selectedId !== null ? (
        <UsageTables key={selectedId} projectId={selectedId} />
      ) : null}
    </SaPage>
  );
}

function UsageTables({ projectId }: { projectId: number }) {
  const [tab, setTab] = useState<UsageTab>("materials");
  const { data, loading, error } = useApiData<UsageData>(() =>
    Promise.all([
      listPmMaterialUsage(projectId),
      listPmEquipmentUsage(projectId),
    ]).then(([materials, equipment]) => ({ materials, equipment })),
  );

  const materials = data?.materials ?? [];
  const equipment = data?.equipment ?? [];

  return (
    <>
      <Tabs
        items={USAGE_TABS}
        active={tab}
        onChange={setTab}
        label="Usage types"
      />

      {tab === "materials" ? (
        <SaPanel title={`Material Usage (${materials.length})`}>
          <SaTable
            columns={materialColumns}
            rows={materials}
            loading={loading}
            error={error}
            emptyText="No material usage recorded for this project yet."
            rowKey={(row) => row.usage_id}
          />
        </SaPanel>
      ) : (
        <SaPanel title={`Equipment Usage (${equipment.length})`}>
          <SaTable
            columns={equipmentColumns}
            rows={equipment}
            loading={loading}
            error={error}
            emptyText="No equipment usage recorded for this project yet."
            rowKey={(row) => row.usage_id}
          />
        </SaPanel>
      )}
    </>
  );
}
