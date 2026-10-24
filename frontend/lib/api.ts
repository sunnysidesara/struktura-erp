// Thin REST client for the Struktura ERP Laravel API (Sanctum bearer tokens).
//
// By default the API host mirrors the host the browser used to load the app, so
// the same build works on http://localhost:3000 and on a LAN address such as
// http://172.16.0.2:3000. Set NEXT_PUBLIC_API_BASE_URL to pin an explicit URL.

const API_BASE_URL_OVERRIDE = process.env.NEXT_PUBLIC_API_BASE_URL;

export function getApiBaseUrl(): string {
  if (API_BASE_URL_OVERRIDE) {
    return API_BASE_URL_OVERRIDE;
  }

  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000/api/v1`;
  }

  return "http://127.0.0.1:8000/api/v1";
}

export type ApiRole = {
  role_id: number | null;
  role_name: string | null;
};

// Shape returned by POST /login, GET /me (user object).
export type ApiUser = {
  user_id: number;
  id_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  contact_number: string | null;
  is_active: boolean;
  created_at?: string | null;
  role: ApiRole;
};

// Frontend role codes used for routing and sidebar selection.
export type RoleCode = "SA" | "PM" | "SS";

// Backend role_name -> frontend role code.
export function roleCodeFromName(roleName?: string | null): RoleCode | null {
  switch (roleName) {
    case "Admin":
      return "SA";
    case "Project Manager":
      return "PM";
    case "Site Supervisor":
      return "SS";
    default:
      return null;
  }
}

export const ROLE_DASHBOARD_PATHS: Record<RoleCode, string> = {
  SA: "/portal/dashboard/sa",
  PM: "/portal/dashboard/pm",
  SS: "/portal/dashboard/ss",
};

// Normalized user persisted in localStorage under "struktura_user".
export type SessionUser = {
  /** Formatted account ID, e.g. SYS010001 (shown across the UI). */
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: RoleCode;
  role_name: string;
};

export function toSessionUser(user: ApiUser): SessionUser | null {
  const role = roleCodeFromName(user.role?.role_name);
  if (!role) return null;

  return {
    user_id: user.id_number,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role,
    role_name: user.role?.role_name ?? "",
  };
}

export const TOKEN_KEY = "struktura_token";
export const USER_KEY = "struktura_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

// --- low-level fetch --------------------------------------------------------

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Cannot reach the server. Please make sure the backend is running.",
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!response.ok) {
    throw new ApiError(
      data.message ?? "Something went wrong. Please try again.",
      response.status,
      data.errors,
    );
  }

  return data as T;
}

// --- endpoints --------------------------------------------------------------

export async function login(idNumber: string, password: string): Promise<{
  message: string;
  token: string;
  user: ApiUser;
}> {
  return request("/login", {
    method: "POST",
    body: { id_number: idNumber, password },
    auth: false,
  });
}

export async function me(): Promise<ApiUser> {
  const data = await request<{ user: ApiUser }>("/me");
  return data.user;
}

export type ApiLoginEntry = {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  status: "success" | "failed";
  created_at: string | null;
};

/** This account's login attempts, newest first (Settings/Profile activity). */
export async function getMyLogins(): Promise<ApiLoginEntry[]> {
  const data = await request<{ data: ApiLoginEntry[] }>("/me/logins");
  return data.data;
}

export type ApiNotification = {
  id: number;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  record_id: number;
  changed_fields: string[];
  project_name: string | null;
  actor: string | null;
  created_at: string | null;
};

/** The 3 most recent audit events relevant to this account (header bell). */
export async function getMyNotifications(): Promise<ApiNotification[]> {
  const data = await request<{ data: ApiNotification[] }>("/me/notifications");
  return data.data;
}

export type ApiUpdateProfilePayload = {
  first_name: string;
  last_name: string;
  email: string;
  contact_number?: string | null;
};

/** Update the signed-in account's own profile (Settings → Profile). */
export async function updateProfile(
  body: ApiUpdateProfilePayload,
): Promise<ApiUser> {
  const data = await request<{ message: string; user: ApiUser }>("/me", {
    method: "PATCH",
    body,
  });
  return data.user;
}

export type ApiChangePasswordPayload = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

/** Change the signed-in account's own password (Settings → Security). */
export async function changePassword(
  body: ApiChangePasswordPayload,
): Promise<void> {
  await request<{ message: string }>("/me/password", {
    method: "POST",
    body,
  });
}

// --- users ------------------------------------------------------------------

export type ApiUserRow = {
  user_id: number;
  id_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role_id: number | null;
  role_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Most recent successful sign-in (ISO 8601) or null if never. */
  last_login_at?: string | null;
};

/** List all user accounts (Admin only). */
export async function listUsers(): Promise<ApiUserRow[]> {
  const data = await request<{ data: ApiUserRow[] }>("/users");
  return data.data;
}

export async function logout(): Promise<void> {
  await request<{ message: string }>("/logout", { method: "POST" });
}

/** Revoke every token for this account (Profile → Sign Out Everywhere). */
export async function logoutEverywhere(): Promise<void> {
  await request<{ message: string }>("/me/logout-all", { method: "POST" });
}

// --- admin console types ----------------------------------------------------

export type ApiSkill = { skill_id: number; skill_name: string; description: string | null; category: string | null; laborer_count?: number };
export type ApiProject = { project_id: number; project_name: string; client_name: string | null; location: string | null; start_date: string | null; end_date: string | null; approved_budget: string | number; remaining_budget: string | number; deadline: string | null; status: string | null; manager_id: string | null; manager_first_name: string | null; manager_last_name: string | null; phase_count: number };
export type ApiPhase = { phase_id: number; project_id: number; project: string; project_name: string | null; description: string | null; sequence_no: number | null; project_cost: string | number | null; planned_start: string | null; planned_end: string | null; status: string | null };
export type ApiAssignment = { assignment_id: number; first_name: string; last_name: string; project: string; phase: string; role_on_task: string | null; status: string | null; assigned_at: string | null; released_at: string | null; hourly_rate_ovveride: string | number | null };
export type ApiEquipment = { equipment_id: number; equipment_name: string; equipment_type: string | null; hourly_rental_rate: string | number | null; equipment_status: string | null };
export type ApiMaterial = { material_id: number; material_name: string; unit_of_measure: string | null; unit_cost: string | number | null };
export type ApiSupplier = { supplier_id: number; supplier_name: string; contact_name: string | null; contact_num: string | null; city: string | null; state_province: string | null; country: string | null };
export type ApiAuditEvent = { audit_log_id: number; project_id: number; project_name: string | null; table_name: string; record_id: number; action_type: string; old_value: unknown; new_value: unknown; charge_at: string | null; id_number: string | null; first_name: string | null; last_name: string | null };
export type ApiLoginAttempt = { id: number; ip_address: string | null; user_agent: string | null; status: "success" | "failed"; created_at: string | null; id_number: string | null; first_name: string | null; last_name: string | null };
export type ApiRoleItem = { role_id: number; role_name: string; description: string | null };
export type ApiDashboardData = { metrics: { total_users: number; active_users: number; skills: number; projects: number; audit_events_today: number; active_sessions: number }; roles: Record<string, number>; activity: { day: string; total: number }[]; recent: { id: number; table_name: string; record_id: number; action_type: string; charge_at: string | null; project_name: string | null; id_number: string | null; first_name: string | null; last_name: string | null }[] };
export type ApiSearchResults = { users: { user_id: number; id_number: string; first_name: string; last_name: string; email: string; is_active: boolean }[]; skills: ApiSkill[]; projects: { project_id: number; project_name: string; client_name: string | null; location: string | null; status: string | null }[] };

// --- admin console endpoints --------------------------------------------------

export const listSkills = async () => (await request<{ data: ApiSkill[] }>("/skills")).data;
export const createSkill = (body: { skill_name: string; description?: string | null; category?: string | null }) => request<{ message: string; data: ApiSkill }>("/skills", { method: "POST", body });
export const updateSkill = (id: number, body: { skill_name: string; description?: string | null; category?: string | null }) => request<{ message: string; data: ApiSkill }>(`/skills/${id}`, { method: "PUT", body });
export const deleteSkill = (id: number) => request<{ message: string }>(`/skills/${id}`, { method: "DELETE" });
export const listRoles = async () => (await request<{ data: ApiRoleItem[] }>("/roles")).data;
export const setUserActive = (id: number, active: boolean) => request<{ message: string }>(`/users/${id}/${active ? "activate" : "deactivate"}`, { method: "PATCH" });
export type ApiCreateUserPayload = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role_id: number;
  is_active?: boolean;
};

/** Create a user account (Admin only). */
export const createUser = (body: ApiCreateUserPayload) =>
  request<{ message: string; data: ApiUserRow }>("/users", { method: "POST", body });
export const getAdminDashboard = () => request<ApiDashboardData>("/admin/dashboard");
export const getAdminProjects = async () => (await request<{ data: ApiProject[] }>("/admin/projects")).data;
export const getAdminPhases = async () => (await request<{ data: ApiPhase[] }>("/admin/phases")).data;
export const getAdminAssignments = async () => (await request<{ data: ApiAssignment[] }>("/admin/assignments")).data;
export const getAdminResources = () => request<{ equipment: ApiEquipment[]; materials: ApiMaterial[]; suppliers: ApiSupplier[] }>("/admin/resources");
export const getAuditEvents = async () => (await request<{ data: ApiAuditEvent[] }>("/admin/audit/events")).data;
export const getAuditLogins = async () => (await request<{ data: ApiLoginAttempt[] }>("/admin/audit/logins")).data;
export const searchAll = (q: string) => request<ApiSearchResults>(`/admin/search?q=${encodeURIComponent(q)}`);
// --- project manager console -------------------------------------------------

export type PmProject = { project_id: number; code: string; project_name: string; client_name: string | null; location: string | null; start_date: string | null; end_date: string | null; deadline: string | null; status: string | null; approved_budget: number; materials_budget: number; equipment_budget: number; remaining_budget: number; spent_budget: number; utilization: number; phase_count: number; worker_count: number; progress: number; manager_id: string | null; manager_name: string; site_supervisor_id: number | null; site_supervisor: string | null; site_supervisor_code: string | null };

/** Active Site Supervisor a PM can attach to a project. */
export type PmSupervisor = { user_id: number; id_number: string; name: string };
export type PmPhase = { phase_id: number; project_id: number; project: string; phase_name: string | null; description: string | null; sequence_no: number | null; project_cost: number; materials_budget: number; equipment_budget: number; planned_start: string | null; planned_end: string | null; status: string | null; completion_requested_at?: string | null; required_skill_id: number | null; required_skill: string | null };
export type PmLaborer = { laborer_id: number; first_name: string; last_name: string; hourly_rate: string | number; employment_status: string; project?: string; phase?: string; role_on_task?: string | null; status?: string | null; assignment_id?: number };
export type PmWorkforce = { available: PmLaborer[]; assigned: PmLaborer[]; skills: Record<string, string[]> };
export type PmMaterial = { material_id: number; material_name: string; unit_of_measure: string | null; unit_cost: string | number | null; stock_quantity: number; supplier_name: string | null; used_quantity?: number };
export type PmEquipment = { equipment_id: number; equipment_name: string; equipment_type: string | null; hourly_rental_rate: string | number | null; equipment_status: string | null; assigned_project: string | null; used_hours?: number };
export type PmAssignment = { assignment_id: number; phase_id: number; first_name: string; last_name: string; project: string; phase: string; role_on_task: string | null; status: string | null; assigned_at: string | null; released_at: string | null; hourly_rate_ovveride: string | number | null };
export type PmBudget = { project_id: number; project: string; approved: number; spent: number; remaining: number; utilization: number; materials_budget: number; materials_spent: number; materials_remaining: number; equipment_budget: number; equipment_spent: number; equipment_remaining: number };
export type PmCostReport = { categories: { category: string; actual: number }[]; totals: { approved: number; actual: number; remaining: number; variance: number; utilization: number } };
export type PmDashboard = { metrics: { projects: number; active_projects: number; completed_projects: number; assigned_workers: number; open_phases: number; approved_budget: number; remaining_budget: number; utilization: number }; costs: { labor: number; materials: number; equipment: number; total: number }; deadlines: PmProject[]; projects: PmProject[] };
export type PmSearchResults = { projects: { project_id: number; project_name: string; client_name: string | null; location: string | null; status: string | null }[]; phases: { phase_id: number; project_id: number; project: string; project_name: string | null; status: string | null }[]; laborers: { laborer_id: number; first_name: string; last_name: string; hourly_rate: string | number; employment_status: string }[] };

export const getPmDashboard = () => request<PmDashboard>("/pm/dashboard");
export const listPmProjects = async () => (await request<{ data: PmProject[] }>("/pm/projects")).data;

/** Adds the PM project selector filter to a read. */
const pmQuery = (projectId?: number | null) => (projectId ? `?project_id=${projectId}` : "");
export const listPmPhases = async (projectId?: number | null) => (await request<{ data: PmPhase[] }>(`/pm/phases${pmQuery(projectId)}`)).data;
export const listPmSiteSupervisors = async () => (await request<{ data: PmSupervisor[] }>("/pm/site-supervisors")).data;
export type PmPhasePayload = {
  phase_name: string;
  description?: string | null;
  sequence_no?: number | null;
  project_cost?: number | null;
  materials_budget?: number | null;
  equipment_budget?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  status?: string | null;
  required_skill_id?: number | null;
};

export const createPmPhase = (body: PmPhasePayload & { project_id: number }) =>
  request<{ message: string; data: PmPhase }>("/pm/phases", { method: "POST", body });

export const updatePmPhase = (id: number, body: PmPhasePayload) =>
  request<{ message: string; data: PmPhase }>(`/pm/phases/${id}`, { method: "PUT", body });

export const deletePmPhase = (id: number) =>
  request<{ message: string }>(`/pm/phases/${id}`, { method: "DELETE" });

export type PmAssignmentPayload = {
  laborer_id: number;
  phase_id: number;
  role_on_task?: string | null;
};

export const createPmAssignment = (body: PmAssignmentPayload) =>
  request<{ message: string; data: { assignment_id: number } }>("/pm/assignments", {
    method: "POST",
    body,
  });

export const deletePmAssignment = (id: number) =>
  request<{ message: string }>(`/pm/assignments/${id}`, { method: "DELETE" });

export type PmProjectPayload = {
  project_name: string;
  client_name?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  approved_budget?: number | null;
  materials_budget?: number | null;
  equipment_budget?: number | null;
  status?: string | null;
  site_supervisor_id?: number | null;
};

/** Create a project owned by the signed-in Project Manager. */
export const createPmProject = (body: PmProjectPayload) =>
  request<{ message: string; data: { project_id: number } }>("/pm/projects", { method: "POST", body });

/** Update one of the signed-in PM's own projects (timeline + status). */
export const updatePmProject = (id: number, body: PmProjectPayload) =>
  request<{ message: string; data: { project_id: number } }>(`/pm/projects/${id}`, { method: "PUT", body });
export const getPmWorkforce = (projectId?: number | null) => request<PmWorkforce>(`/pm/workforce${pmQuery(projectId)}`);
export const getPmSkillMatch = (phaseId: number) => request<{ phase: PmPhase; required_skill: string | null; data: PmLaborer[] }>(`/pm/skill-match?phase_id=${phaseId}`);

/** Read-only skill list for the PM's phase requirement picker. */
export const listPmSkills = async () => (await request<{ data: ApiSkill[] }>("/pm/skills")).data;
export const listPmMaterials = async (projectId?: number | null) => (await request<{ data: PmMaterial[] }>(`/pm/materials${pmQuery(projectId)}`)).data;
export const listPmEquipment = async (projectId?: number | null) => (await request<{ data: PmEquipment[] }>(`/pm/equipment${pmQuery(projectId)}`)).data;
export const listPmAssignments = async (projectId?: number | null) => (await request<{ data: PmAssignment[] }>(`/pm/assignments${pmQuery(projectId)}`)).data;
export const listPmBudgets = async (projectId?: number | null) => (await request<{ data: PmBudget[] }>(`/pm/budgets${pmQuery(projectId)}`)).data;
export const getPmCostReport = (projectId?: number | null) => request<PmCostReport>(`/pm/cost-report${pmQuery(projectId)}`);

/** Cost breakdown per phase (Cost Reports tab). */
export type PmPhaseCost = {
  phase_id: number;
  phase: string;
  sequence: number;
  status: string | null;
  labor: number;
  materials: number;
  equipment: number;
  total: number;
};

export const listPmPhaseCosts = async (projectId?: number | null) =>
  (await request<{ data: PmPhaseCost[] }>(`/pm/phase-costs${pmQuery(projectId)}`)).data;
export const listPmBalance = async (projectId?: number | null) => (await request<{ data: PmBudget[] }>(`/pm/balance${pmQuery(projectId)}`)).data;
export const searchPm = (q: string) => request<PmSearchResults>(`/pm/search?q=${encodeURIComponent(q)}`);

/** Material usage entries for one project (detail popup). */
export type PmMaterialUsageEntry = {
  usage_id: number;
  material_id: number;
  material: string;
  quantity: number;
  unit: string | null;
  date: string;
  phase_id: number;
  phase: string;
};

/** Equipment usage entries for one project (detail popup). */
export type PmEquipmentUsageEntry = {
  usage_id: number;
  equipment_id: number;
  equipment: string;
  hours: number;
  date: string;
  phase_id: number;
  phase: string;
};

export type PmCatalogMaterial = {
  material_id: number;
  material_name: string;
  unit_of_measure: string | null;
  unit_cost: number;
  stock_quantity: number;
};

export type PmCatalogEquipment = {
  equipment_id: number;
  equipment_name: string;
  equipment_type: string | null;
  hourly_rental_rate: number;
  equipment_status: string | null;
};

export const listPmMaterialCatalog = async () =>
  (await request<{ data: PmCatalogMaterial[] }>("/pm/material-catalog")).data;
export const listPmEquipmentCatalog = async () =>
  (await request<{ data: PmCatalogEquipment[] }>("/pm/equipment-catalog")).data;

export const listPmMaterialUsage = async (projectId?: number | null) =>
  (await request<{ data: PmMaterialUsageEntry[] }>(`/pm/material-usage${pmQuery(projectId)}`)).data;
export const createPmMaterialUsage = (body: {
  material_id: number;
  phase_id: number;
  usage_date: string;
  quantity_used: number;
}) => request<{ message: string }>("/pm/material-usage", { method: "POST", body });
export const deletePmMaterialUsage = (id: number) =>
  request<{ message: string }>(`/pm/material-usage/${id}`, { method: "DELETE" });

export const listPmEquipmentUsage = async (projectId?: number | null) =>
  (await request<{ data: PmEquipmentUsageEntry[] }>(`/pm/equipment-usage${pmQuery(projectId)}`)).data;
export const createPmEquipmentUsage = (body: {
  equipment_id: number;
  phase_id: number;
  usage_date: string;
  hours_used: number;
}) => request<{ message: string }>("/pm/equipment-usage", { method: "POST", body });
export const deletePmEquipmentUsage = (id: number) =>
  request<{ message: string }>(`/pm/equipment-usage/${id}`, { method: "DELETE" });

// --- site supervisor console -------------------------------------------------

export type SsSite = {
  project_id: number;
  code: string;
  project: string;
  description: string;
  location: string | null;
  client: string | null;
  supervisor: string;
  supervisor_id: string | null;
  supervisorEmail: string | null;
  manager: string;
  managerEmail: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  deadline: string | null;
  currentPhase: string | null;
  budgets: { total: number; materials: number; equipment: number; labor: number };
  spend: { materials: number; equipment: number; labor: number; total: number };
  coordinates: { lat: number | null; lng: number | null };
};

export type SsPhase = {
  phase_id: number;
  id: string;
  project_id: number;
  name: string;
  description: string | null;
  sequence: number;
  progress: number;
  status: string | null;
  completionRequestedAt: string | null;
  workers: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  required_skill_id: number | null;
};

export type SsWorker = {
  id: string;
  laborer_id: number;
  name: string;
  skill: string;
  skills: string[];
  status: string | null;
  contact: string | null;
};

export type SsAssignment = {
  assignment_id: number;
  laborer_id: number;
  worker: string;
  phase_id: number;
  phase: string | null;
  role_on_task: string | null;
  status: string | null;
};

/** A project the supervisor can switch between in the site switcher. */
export type SsSiteOption = {
  project_id: number;
  code: string;
  project: string;
  location: string | null;
  status: string | null;
  progress: number;
};

export type SsTask = {
  id: string;
  task_id: number;
  date: string;
  time: string;
  title: string;
  phase: string;
  assignee: string;
  status: string;
  project?: string | null;
  project_id?: number;
};

export type SsLaborLog = {
  id: string;
  log_id: number;
  assignment_id: number;
  date: string;
  shift: string;
  time_in: string | null;
  time_out: string | null;
  worker: string;
  regular: number;
  overtime: number;
  total: number;
  phase_id: number;
  phase: string | null;
  project_id: number;
  project: string;
  status: string;
};

export type SsMaterialLog = {
  id: string;
  usage_id: number;
  material_id: number;
  date: string;
  material: string;
  quantity: number;
  unit: string | null;
  expense: number;
  phase_id: number;
  phase: string | null;
  project_id: number;
  project: string;
  status: string;
};

export type SsEquipmentLog = {
  id: string;
  usage_id: number;
  equipment_id: number;
  date: string;
  equipment: string;
  hours: number;
  expense: number;
  phase_id: number;
  phase: string | null;
  project_id: number;
  project: string;
  status: string;
};

export type SsMaterial = {
  material_id: number;
  name: string;
  unit: string | null;
  stock: number;
};

export type SsEquipment = {
  equipment_id: number;
  name: string;
  type: string | null;
  status: string | null;
};

export type SsSubmission = {
  date: string;
  labor: number;
  materials: number;
  equipment: number;
  status: string;
};

export type SsSeriesPoint = { label: string; date: string; value: number };

export type SsDashboard = {
  server_date: string;
  sites: SsSiteOption[];
  selected_project_id: number | null;
  site: SsSite | null;
  metrics: {
    labor_hours_today: number;
    material_entries_today: number;
    equipment_hours_today: number;
    active_phases: number;
    total_phases: number;
  };
  labor_series: SsSeriesPoint[];
  phases: SsPhase[];
  submissions: SsSubmission[];
};

export type SsSiteResponse = {
  server_date: string;
  site: SsSite | null;
  metrics: {
    overall_progress: number;
    completed_phases: number;
    total_phases: number;
    days_remaining: number;
    active_workers: number;
    total_workers: number;
  };
  phases: SsPhase[];
};

export type SsSiteInfoResponse = {
  server_date: string;
  site: SsSite | null;
  phases: SsPhase[];
};

export type SsScheduleResponse = {
  scope: string;
  server_date: string;
  data: SsTask[];
  counts: { total: number; done: number; in_progress: number; pending: number };
};

export type SsLogHoursResponse = {
  server_date: string;
  assignments: SsAssignment[];
  workers: SsWorker[];
  logs: SsLaborLog[];
  series: SsSeriesPoint[];
  metrics: { hours_today: number; logs_today: number; crew: number; total_logs: number };
};

export type SsMaterialsResponse = {
  server_date: string;
  materials: SsMaterial[];
  phases: SsPhase[];
  logs: SsMaterialLog[];
  series: SsSeriesPoint[];
  metrics: {
    entries_today: number;
    distinct_today: number;
    total_logs: number;
    materials_allocation: number;
    materials_spent: number;
    materials_remaining: number;
  };
};

export type SsEquipmentResponse = {
  server_date: string;
  equipment: SsEquipment[];
  phases: SsPhase[];
  logs: SsEquipmentLog[];
  series: SsSeriesPoint[];
  metrics: {
    hours_today: number;
    logs_today: number;
    machines_today: number;
    total_logs: number;
    equipment_allocation: number;
    equipment_spent: number;
    equipment_remaining: number;
  };
};

export type SsWorkersResponse = {
  data: SsWorker[];
  metrics: { total: number; active: number; inactive: number; skills: number };
};

export type SsPhasesResponse = {
  data: SsPhase[];
  metrics: { total: number; completed: number; in_progress: number; average_progress: number };
};

export type SsSearchResponse = {
  query: string;
  workers: SsWorker[];
  phases: SsPhase[];
  tasks: SsTask[];
  materials: SsMaterialLog[];
  equipment: SsEquipmentLog[];
};

export type SsWriteResponse = {
  message: string;
  data: Record<string, number | string>;
};
/** Adds the site-switcher filter to every supervisor read. */
export const ssQuery = (projectId?: number | null) => (projectId ? `?project_id=${projectId}` : "");

export const getSsSites = () =>
  request<{ data: SsSiteOption[]; selected_project_id: number | null }>("/ss/sites");
export const getSsDashboard = (projectId?: number | null) =>
  request<SsDashboard>(`/ss/dashboard${ssQuery(projectId)}`);
export const getSsSite = (projectId?: number | null) =>
  request<SsSiteResponse>(`/ss/site${ssQuery(projectId)}`);
export const getSsSiteInfo = (projectId?: number | null) =>
  request<SsSiteInfoResponse>(`/ss/site/info${ssQuery(projectId)}`);
export const getSsSchedule = (scope: "today" | "week" | "all", projectId?: number | null) =>
  request<SsScheduleResponse>(
    `/ss/schedule?scope=${scope}${projectId ? `&project_id=${projectId}` : ""}`,
  );
export const getSsLogHours = (projectId?: number | null) =>
  request<SsLogHoursResponse>(`/ss/log-hours${ssQuery(projectId)}`);
export type SsLaborLogBody = {
  assignment_id: number;
  log_date: string;
  shift?: string;
  time_in?: string | null;
  time_out?: string | null;
  regular_hours?: number;
  overtime_hours?: number;
};
export const createSsLaborLog = (body: SsLaborLogBody) =>
  request<SsWriteResponse>("/ss/log-hours", { method: "POST", body });
export const updateSsLaborLog = (id: number, body: SsLaborLogBody) =>
  request<SsWriteResponse>(`/ss/log-hours/${id}`, { method: "PUT", body });
export const deleteSsLaborLog = (id: number) =>
  request<{ message: string }>(`/ss/log-hours/${id}`, { method: "DELETE" });
export const getSsMaterials = (projectId?: number | null) =>
  request<SsMaterialsResponse>(`/ss/materials${ssQuery(projectId)}`);
export type SsMaterialUsageBody = {
  material_id: number;
  phase_id: number;
  usage_date: string;
  quantity_used: number;
};
export const createSsMaterialUsage = (body: SsMaterialUsageBody) =>
  request<SsWriteResponse>("/ss/materials", { method: "POST", body });
export const updateSsMaterialUsage = (id: number, body: SsMaterialUsageBody) =>
  request<SsWriteResponse>(`/ss/materials/${id}`, { method: "PUT", body });
export const deleteSsMaterialUsage = (id: number) =>
  request<{ message: string }>(`/ss/materials/${id}`, { method: "DELETE" });
export const getSsEquipment = (projectId?: number | null) =>
  request<SsEquipmentResponse>(`/ss/equipment${ssQuery(projectId)}`);
export const createSsEquipmentUsage = (body: {
  equipment_id: number;
  phase_id: number;
  usage_date: string;
  hours_used: number;
}) => request<SsWriteResponse>("/ss/equipment", { method: "POST", body });
export const updateSsEquipmentUsage = (
  id: number,
  body: { equipment_id: number; phase_id: number; usage_date: string; hours_used: number },
) => request<SsWriteResponse>(`/ss/equipment/${id}`, { method: "PUT", body });
export const deleteSsEquipmentUsage = (id: number) =>
  request<{ message: string }>(`/ss/equipment/${id}`, { method: "DELETE" });
export const getSsWorkers = (projectId?: number | null) =>
  request<SsWorkersResponse>(`/ss/workers${ssQuery(projectId)}`);
export const getSsPhases = (projectId?: number | null) =>
  request<SsPhasesResponse>(`/ss/phases${ssQuery(projectId)}`);
/** Ask the Project Manager to sign a phase off. */
export const requestSsPhaseCompletion = (phaseId: number) =>
  request<SsWriteResponse>(`/ss/phases/${phaseId}/request-completion`, { method: "POST" });
export const getSsSearch = (q: string, projectId?: number | null) =>
  request<SsSearchResponse>(
    `/ss/search?q=${encodeURIComponent(q)}${projectId ? `&project_id=${projectId}` : ""}`,
  );