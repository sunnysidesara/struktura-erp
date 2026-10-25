"use client";

import { useEffect, useState, type FormEvent } from "react";
import { searchAll, type ApiSearchResults } from "@/lib/api";
import { SaPage, SaPanel, SaTable, StatusBadge, Tabs, money, type SaColumn } from "@/app/portal/dashboard/sa/_components/SaPage";
import styles from "../page.module.css";

type UserHit = ApiSearchResults["users"][number];
type SkillHit = ApiSearchResults["skills"][number];
type ProjectHit = ApiSearchResults["projects"][number];
type PhaseHit = ApiSearchResults["phases"][number];
type AssignmentHit = ApiSearchResults["assignments"][number];
type MaterialHit = ApiSearchResults["materials"][number];
type EquipmentHit = ApiSearchResults["equipment"][number];

type SearchTab =
  | "users"
  | "skills"
  | "projects"
  | "phases"
  | "assignments"
  | "materials"
  | "equipment";

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ApiSearchResults | null>(null);
  const [tab, setTab] = useState<SearchTab>("users");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runSearch = async (value: string) => {
    const q = value.trim();
    if (!q) { setResults(null); setError(""); return; }
    setLoading(true);
    setError("");
    try { setResults(await searchAll(q)); }
    catch (err) { setError(err instanceof Error ? err.message : "Search failed."); }
    finally { setLoading(false); }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(term);
  };

  // The dashboard header search box lands here with ?q=...
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.trim();
    if (!q) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTerm(q);
    void runSearch(q);
  }, []);

  const userColumns: SaColumn<UserHit>[] = [
    { key: "id", label: "User ID", render: (row) => row.id_number },
    { key: "name", label: "Name", render: (row) => `${row.first_name} ${row.last_name}` },
    { key: "email", label: "Email", render: (row) => row.email },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.is_active ? "Active" : "Inactive"} /> },
  ];

  const skillColumns: SaColumn<SkillHit>[] = [
    { key: "name", label: "Skill", render: (row) => row.skill_name },
    { key: "desc", label: "Description", render: (row) => row.description ?? "-" },
  ];

  const projectColumns: SaColumn<ProjectHit>[] = [
    { key: "name", label: "Project", render: (row) => row.project_name },
    { key: "client", label: "Client", render: (row) => row.client_name ?? "-" },
    { key: "location", label: "Location", render: (row) => row.location ?? "-" },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
  ];

  const phaseColumns: SaColumn<PhaseHit>[] = [
    { key: "name", label: "Phase", render: (row) => row.phase_name ?? "-" },
    { key: "project", label: "Project", render: (row) => row.project },
    { key: "description", label: "Description", render: (row) => row.description ?? "-" },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
  ];

  const assignmentColumns: SaColumn<AssignmentHit>[] = [
    { key: "worker", label: "Worker", render: (row) => row.worker },
    { key: "project", label: "Project", render: (row) => row.project },
    { key: "phase", label: "Phase", render: (row) => row.phase ?? "-" },
    { key: "role", label: "Role on Task", render: (row) => row.role_on_task ?? "-" },
    { key: "status", label: "Status", status: true, render: (row) => <StatusBadge status={row.status} /> },
  ];

  const materialColumns: SaColumn<MaterialHit>[] = [
    { key: "name", label: "Material", render: (row) => row.material_name },
    { key: "unit", label: "Unit", render: (row) => row.unit_of_measure ?? "-" },
    { key: "cost", label: "Unit Cost", render: (row) => money(row.unit_cost) },
    { key: "stock", label: "Stock", render: (row) => String(row.stock_quantity) },
  ];

  const equipmentColumns: SaColumn<EquipmentHit>[] = [
    { key: "name", label: "Equipment", render: (row) => row.equipment_name },
    { key: "type", label: "Type", render: (row) => row.equipment_type ?? "-" },
    { key: "rate", label: "Hourly Rate", render: (row) => money(row.hourly_rental_rate) },
    {
      key: "status",
      label: "Status",
      status: true,
      render: (row) => <StatusBadge status={row.equipment_status} />,
    },
  ];

  return (
    <SaPage kicker="Search" title="Search" subtitle="Find users, skills, projects, phases, assignments, materials and equipment across the system">
      <SaPanel title="Global Search" filters={<form onSubmit={submit} style={{ display: "flex", gap: "0.5rem" }}>
        <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search..." />
        <button type="submit" className={styles.linkButton}>Search</button>
      </form>}>
        {loading ? <p className={styles.muted}>Searching...</p> : error ? <p className={styles.alert}>{error}</p> : results ? <p className={styles.muted}>Results for &quot;{term}&quot;.</p> : <p className={styles.muted}>Enter a term and press Search.</p>}
      </SaPanel>

      {results ? (
        <>
          <Tabs
            items={[
              { id: "users", label: `Users (${results.users.length})` },
              { id: "skills", label: `Skills (${results.skills.length})` },
              { id: "projects", label: `Projects (${results.projects.length})` },
              { id: "phases", label: `Phases (${results.phases.length})` },
              { id: "assignments", label: `Assignments (${results.assignments.length})` },
              { id: "materials", label: `Materials (${results.materials.length})` },
              { id: "equipment", label: `Equipment (${results.equipment.length})` },
            ]}
            active={tab}
            onChange={setTab}
            label="Search result groups"
          />

          {tab === "users" ? (
            <SaPanel title={`Users (${results.users.length})`}>
              <SaTable columns={userColumns} rows={results.users} emptyText="No matching users." rowKey={(row) => row.user_id} />
            </SaPanel>
          ) : null}

          {tab === "skills" ? (
            <SaPanel title={`Skills (${results.skills.length})`}>
              <SaTable columns={skillColumns} rows={results.skills} emptyText="No matching skills." rowKey={(row) => row.skill_id} />
            </SaPanel>
          ) : null}

          {tab === "projects" ? (
            <SaPanel title={`Projects (${results.projects.length})`}>
              <SaTable columns={projectColumns} rows={results.projects} emptyText="No matching projects." rowKey={(row) => row.project_id} />
            </SaPanel>
          ) : null}

          {tab === "phases" ? (
            <SaPanel title={`Phases (${results.phases.length})`}>
              <SaTable columns={phaseColumns} rows={results.phases} emptyText="No matching phases." rowKey={(row) => row.phase_id} />
            </SaPanel>
          ) : null}

          {tab === "assignments" ? (
            <SaPanel title={`Assignments (${results.assignments.length})`}>
              <SaTable columns={assignmentColumns} rows={results.assignments} emptyText="No matching assignments." rowKey={(row) => row.assignment_id} />
            </SaPanel>
          ) : null}

          {tab === "materials" ? (
            <SaPanel title={`Materials (${results.materials.length})`}>
              <SaTable columns={materialColumns} rows={results.materials} emptyText="No matching materials." rowKey={(row) => row.material_id} />
            </SaPanel>
          ) : null}

          {tab === "equipment" ? (
            <SaPanel title={`Equipment (${results.equipment.length})`}>
              <SaTable columns={equipmentColumns} rows={results.equipment} emptyText="No matching equipment." rowKey={(row) => row.equipment_id} />
            </SaPanel>
          ) : null}
        </>
      ) : null}
    </SaPage>
  );
}
