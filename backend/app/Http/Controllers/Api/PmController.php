<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\Role;
use App\Models\EquipmentUsage;
use App\Models\Material;
use App\Models\MaterialUsage;
use App\Models\WorkforceAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PmController extends Controller
{
    /** Statuses a Project Manager may set on their own projects. */
    private const PROJECT_STATUSES = ['Not Started', 'On Track', 'Delayed', 'On Hold', 'Completed'];
    private const PROJECT_TRANSITIONS = [
        'Not Started' => ['On Track'],
        'On Track' => ['Delayed', 'On Hold', 'Completed'],
        'Delayed' => ['On Track', 'On Hold', 'Completed'],
        'On Hold' => ['On Track', 'Delayed', 'Completed'],
        'Completed' => [],
    ];
    /**
     * Project ids visible to the current user (all for Admin, own for Project Manager).
     *
     * @return array<int, int>
     */
    /**
     * Every project id the signed-in PM may access (all for the Admin).
     *
     * @return array<int, int>
     */
    /**
     * Phase that belongs to the given projects.
     */
    private function phaseFor(array $ids, int $phaseId): ?object
    {
        if (empty($ids)) {
            return null;
        }

        return DB::table('project_phases')
            ->whereIn('project_id', $ids)
            ->where('phase_id', $phaseId)
            ->first();
    }

    /**
     * Move material stock through the Material model so the change is audited.
     */
    private function adjustMaterialStock(int $materialId, float $units): void
    {
        $material = Material::query()->lockForUpdate()->find($materialId);

        if (! $material) {
            return;
        }

        $next = (int) round((float) $material->stock_quantity + $units);

        $material->update(['stock_quantity' => max(0, $next)]);
    }

    /**
     * "12 pcs" style stock label for validation messages.
     */
    private function stockLabel(object $material): string
    {
        $amount = rtrim(rtrim(number_format((float) $material->stock_quantity, 2, '.', ''), '0'), '.');

        return $amount.' '.($material->unit_of_measure ?? 'unit(s)');
    }

    /**
     * Material usage rows for the detail popup.
     *
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function materialUsageQuery(array $ids, int $limit = 60): array
    {
        if (empty($ids)) {
            return [];
        }

        return DB::table('material_usage as mu')
            ->join('materials as m', 'm.material_id', '=', 'mu.material_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->orderByDesc('mu.usage_date')
            ->orderByDesc('mu.material_usage_id')
            ->limit($limit)
            ->select(
                'mu.material_usage_id',
                'mu.material_id',
                'mu.usage_date',
                'mu.quantity_used',
                'm.material_name',
                'm.unit_of_measure',
                'ph.phase_id',
                'ph.project_name as phase_name'
            )
            ->get()
            ->map(fn ($row) => [
                'usage_id' => (int) $row->material_usage_id,
                'material_id' => (int) $row->material_id,
                'material' => $row->material_name,
                'quantity' => (float) $row->quantity_used,
                'unit' => $row->unit_of_measure,
                'date' => $row->usage_date,
                'phase_id' => (int) $row->phase_id,
                'phase' => $row->phase_name,
            ])
            ->values()
            ->all();
    }

    /**
     * Equipment usage rows for the detail popup.
     *
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function equipmentUsageQuery(array $ids, int $limit = 60): array
    {
        if (empty($ids)) {
            return [];
        }

        return DB::table('equipment_usage as eu')
            ->join('equipment as e', 'e.equipment_id', '=', 'eu.equipment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->orderByDesc('eu.usage_date')
            ->orderByDesc('eu.equipment_usage_id')
            ->limit($limit)
            ->select(
                'eu.equipment_usage_id',
                'eu.equipment_id',
                'eu.usage_date',
                'eu.hours_used',
                'e.equipment_name',
                'ph.phase_id',
                'ph.project_name as phase_name'
            )
            ->get()
            ->map(fn ($row) => [
                'usage_id' => (int) $row->equipment_usage_id,
                'equipment_id' => (int) $row->equipment_id,
                'equipment' => $row->equipment_name,
                'hours' => (float) $row->hours_used,
                'date' => $row->usage_date,
                'phase_id' => (int) $row->phase_id,
                'phase' => $row->phase_name,
            ])
            ->values()
            ->all();
    }

    private function allowedProjectIds(Request $request): array
    {
        $user = $request->user();
        $query = DB::table('projects');

        if ($user->role?->role_name !== Role::ADMIN) {
            $query->where('user_id', $user->user_id);
        }

        return array_map('intval', $query->pluck('project_id')->all());
    }

    /**
     * Project ids in scope for this request: narrowed by the page's project
     * selector (`?project_id=`) but never outside the PM's own projects.
     *
     * @return array<int, int>
     */
    private function projectIds(Request $request): array
    {
        $ids = $this->allowedProjectIds($request);
        $selected = (int) $request->query('project_id', 0);

        if ($selected > 0 && in_array($selected, $ids, true)) {
            return [$selected];
        }

        return $ids;
    }

    private function projectsFor(Request $request)
    {
        $ids = $this->projectIds($request);

        if (empty($ids)) {
            return collect();
        }

        return DB::table('projects as p')
            ->leftJoin('users as u', 'u.user_id', '=', 'p.user_id')
            ->leftJoin('users as ss', 'ss.user_id', '=', 'p.site_supervisor_id')
            ->whereIn('p.project_id', $ids)
            ->select(
                'p.project_id',
                'p.project_name',
                'p.client_name',
                'p.location',
                'p.start_date',
                'p.end_date',
                'p.deadline',
                'p.status',
                'p.approved_budget',
                'p.materials_budget',
                'p.equipment_budget',
                'p.remaining_budget',
                'u.id_number as manager_id',
                'u.first_name as manager_first_name',
                'u.last_name as manager_last_name',
                'p.site_supervisor_id',
                'ss.id_number as supervisor_id_number',
                'ss.first_name as supervisor_first_name',
                'ss.last_name as supervisor_last_name',
                DB::raw('(SELECT COUNT(*) FROM project_phases ph WHERE ph.project_id = p.project_id) as phase_count'),
                DB::raw('(SELECT COUNT(*) FROM project_phases ph2 WHERE ph2.project_id = p.project_id AND ph2.status = "Completed") as completed_phases'),
                DB::raw('(SELECT COUNT(DISTINCT wa.laborer_id) FROM workforce_assignment wa JOIN project_phases ph3 ON ph3.phase_id = wa.phase_id WHERE ph3.project_id = p.project_id AND wa.status = "Active") as worker_count')
            )
            ->orderBy('p.project_id')
            ->get()
            ->map(function ($row) {
                $phaseCount = (int) $row->phase_count;
                $progress = $phaseCount > 0 ? (int) round(((int) $row->completed_phases / $phaseCount) * 100) : 0;
                $approved = (float) $row->approved_budget;
                $remaining = (float) $row->remaining_budget;
                $spent = $approved - $remaining;

                return [
                    'project_id' => (int) $row->project_id,
                    'code' => 'PRJ-'.str_pad((string) $row->project_id, 4, '0', STR_PAD_LEFT),
                    'project_name' => $row->project_name,
                    'client_name' => $row->client_name,
                    'location' => $row->location,
                    'start_date' => $row->start_date,
                    'end_date' => $row->end_date,
                    'deadline' => $row->deadline,
                    'status' => $row->status,
                    'approved_budget' => $approved,
                    'materials_budget' => round((float) $row->materials_budget, 2),
                    'equipment_budget' => round((float) $row->equipment_budget, 2),
                    'remaining_budget' => $remaining,
                    'spent_budget' => round($spent, 2),
                    'utilization' => $approved > 0 ? (int) round(($spent / $approved) * 100) : 0,
                    'phase_count' => $phaseCount,
                    'worker_count' => (int) $row->worker_count,
                    'progress' => $progress,
                    'manager_id' => $row->manager_id,
                    'manager_name' => trim(($row->manager_first_name ?? '').' '.($row->manager_last_name ?? '')),
                    'site_supervisor_id' => $row->site_supervisor_id !== null ? (int) $row->site_supervisor_id : null,
                    'site_supervisor' => trim(($row->supervisor_first_name ?? '').' '.($row->supervisor_last_name ?? '')),
                    'site_supervisor_code' => $row->supervisor_id_number,
                ];
            });
    }

    public function dashboard(Request $request): JsonResponse
    {
        $projects = $this->projectsFor($request);
        $ids = $projects->pluck('project_id')->all();

        $approved = (float) $projects->sum('approved_budget');
        $remaining = (float) $projects->sum('remaining_budget');
        $spent = $approved - $remaining;

        $labor = $this->costSum('labor', $ids);
        $materials = $this->costSum('materials', $ids);
        $equipment = $this->costSum('equipment', $ids);

        return response()->json([
            'metrics' => [
                'projects' => $projects->count(),
                'active_projects' => $projects->where('status', '!=', 'Completed')->count(),
                'completed_projects' => $projects->where('status', 'Completed')->count(),
                'assigned_workers' => $this->assignedWorkerCount($ids),
                'open_phases' => $this->openPhaseCount($ids),
                'approved_budget' => $approved,
                'remaining_budget' => $remaining,
                'utilization' => $approved > 0 ? (int) round(($spent / $approved) * 100) : 0,
            ],
            'costs' => [
                'labor' => $labor,
                'materials' => $materials,
                'equipment' => $equipment,
                'total' => $labor + $materials + $equipment,
            ],
            'deadlines' => $projects
                // Upcoming only: completed projects and past deadlines are noise.
                ->filter(fn ($project) => ($project['status'] ?? '') !== 'Completed'
                    && ! empty($project['deadline'])
                    && now()->startOfDay()->lte($project['deadline']))
                ->sortBy('deadline')
                ->take(5)
                ->values(),
            'projects' => $projects->values(),
        ]);
    }

    public function projects(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->projectsFor($request)->values()]);
    }    public function phases(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);

        if (empty($ids)) {
            return response()->json(['data' => []]);
        }

        $phases = DB::table('project_phases as ph')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->leftJoin('skill as s', 's.skill_id', '=', 'ph.required_skill_id')
            ->whereIn('ph.project_id', $ids)
            ->select(
                'ph.phase_id',
                'ph.project_id',
                'p.project_name as project',
                'ph.project_name',
                'ph.description',
                'ph.sequence_no',
                'ph.project_cost',
                'ph.materials_budget',
                'ph.equipment_budget',
                'ph.planned_start',
                'ph.planned_end',
                'ph.status',
                'ph.completion_requested_at',
                'ph.required_skill_id',
                's.skill_name as required_skill'
            )
            ->orderBy('ph.project_id')
            ->orderBy('ph.sequence_no')
            ->get()
            ->map(fn ($row) => [
                'phase_id' => (int) $row->phase_id,
                'project_id' => (int) $row->project_id,
                'project' => $row->project,
                'phase_name' => $row->project_name,
                'description' => $row->description,
                'sequence_no' => $row->sequence_no,
                'project_cost' => (float) $row->project_cost,
                'materials_budget' => (float) $row->materials_budget,
                'equipment_budget' => (float) $row->equipment_budget,
                'planned_start' => $row->planned_start,
                'planned_end' => $row->planned_end,
                'status' => $row->status,
                'completion_requested_at' => $row->completion_requested_at,
                'required_skill_id' => $row->required_skill_id,
                'required_skill' => $row->required_skill,
            ]);

        return response()->json(['data' => $phases]);
    }

    /**
     * Create a project owned by the signed-in Project Manager.
     */
    public function storeProject(Request $request): JsonResponse
    {
        $data = $this->validateProject($request, true);
        $userId = $request->user()->user_id;
        $approved = (float) ($data['approved_budget'] ?? 0);
        $materials = array_key_exists('materials_budget', $data) && $data['materials_budget'] !== null
            ? (float) $data['materials_budget']
            : round($approved * 0.50, 2);
        $equipment = array_key_exists('equipment_budget', $data) && $data['equipment_budget'] !== null
            ? (float) $data['equipment_budget']
            : round($approved * 0.15, 2);

        $this->assertAllocations($approved, $materials, $equipment);

        $project = Project::create([
            'project_name' => $data['project_name'],
            'client_name' => $data['client_name'] ?? null,
            'location' => $data['location'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'approved_budget' => round($approved, 2),
            // Allocations come from the PM form; the split above only applies
            // when the request omits them.
            'materials_budget' => round($materials, 2),
            'equipment_budget' => round($equipment, 2),
            // A brand-new project has spent nothing yet.
            'remaining_budget' => $approved,
            'status' => 'Not Started',
            // Ownership is always the PM creating it.
            'user_id' => $userId,
            'created_by' => $userId,
            'updated_by' => $userId,
            'site_supervisor_id' => $data['site_supervisor_id'],
        ]);

        return response()->json([
            'message' => 'Project created successfully.',
            'data' => $project,
        ], 201);
    }

    /**
     * Update one of the signed-in PM's own projects (timeline + status).
     */
    public function updateProject(Request $request, Project $project): JsonResponse
    {
        if ((int) $project->user_id !== (int) $request->user()->user_id) {
            return response()->json([
                'message' => 'You can only edit projects assigned to you.',
            ], 403);
        }

        $data = $this->validateProject($request);

        $currentApproved = (float) $project->approved_budget;
        $approved = array_key_exists('approved_budget', $data) && $data['approved_budget'] !== null
            ? (float) $data['approved_budget']
            : $currentApproved;
        $materials = array_key_exists('materials_budget', $data) && $data['materials_budget'] !== null
            ? (float) $data['materials_budget']
            : (float) $project->materials_budget;
        $equipment = array_key_exists('equipment_budget', $data) && $data['equipment_budget'] !== null
            ? (float) $data['equipment_budget']
            : (float) $project->equipment_budget;

        $this->assertAllocations($approved, $materials, $equipment);

        // Spend already posted against the project must survive a budget edit.
        $spent = max(0.0, round($currentApproved - (float) $project->remaining_budget, 2));

        $project->update([
            'project_name' => $data['project_name'],
            'client_name' => $data['client_name'] ?? null,
            'location' => $data['location'] ?? null,
            'start_date' => $data['start_date'] ?? null,
            'end_date' => $data['end_date'] ?? null,
            'site_supervisor_id' => $data['site_supervisor_id'] ?? $project->site_supervisor_id,
            'approved_budget' => round($approved, 2),
            'materials_budget' => round($materials, 2),
            'equipment_budget' => round($equipment, 2),
            'remaining_budget' => round(max(0.0, $approved - $spent), 2),
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Project updated successfully.',
            'data' => $project->fresh(),
        ]);
    }

    /**
     * Move one of the PM's projects through its status flow.
     */
    public function changeProjectStatus(Request $request, Project $project): JsonResponse
    {
        if ((int) $project->user_id !== (int) $request->user()->user_id) {
            return response()->json([
                'message' => 'You can only change projects assigned to you.',
            ], 403);
        }

        $data = $request->validate([
            'status' => ['required', Rule::in(self::PROJECT_STATUSES)],
        ]);

        $current = $project->status ?? 'Not Started';
        $allowed = self::PROJECT_TRANSITIONS[$current] ?? [];

        if (! in_array($data['status'], $allowed, true)) {
            return response()->json([
                'message' => 'Project status cannot move from '.$current.' to '.$data['status'].'.',
            ], 422);
        }

        $project->update([
            'status' => $data['status'],
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Project moved to '.$data['status'].'.',
            'data' => $project->fresh(),
        ]);
    }

    /**
     * Move a Not Started phase into In Progress.
     */
    public function startPhase(Request $request, int $phase): JsonResponse
    {
        $row = $this->phaseFor($this->projectIds($request), $phase);

        if (! $row) {
            return response()->json(['message' => 'Phase not found.'], 404);
        }

        if ($row->status !== 'Not Started') {
            return response()->json([
                'message' => 'Only a Not Started phase can be started.',
            ], 422);
        }

        $model = ProjectPhase::findOrFail($phase);
        $model->update([
            'status' => 'In Progress',
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Phase started.',
            'data' => $model->fresh(),
        ]);
    }

    /**
     * Approve a pending supervisor completion request.
     */
    public function approvePhaseCompletion(Request $request, int $phase): JsonResponse
    {
        $row = $this->phaseFor($this->projectIds($request), $phase);

        if (! $row) {
            return response()->json(['message' => 'Phase not found.'], 404);
        }

        if ($row->status !== 'In Progress') {
            return response()->json([
                'message' => 'Only an In Progress phase can be completed.',
            ], 422);
        }

        if (! $row->completion_requested_at) {
            return response()->json([
                'message' => 'The Site Supervisor has not requested completion for this phase.',
            ], 422);
        }

        $totalTasks = DB::table('site_task')->where('phase_id', $phase)->count();
        $openTasks = DB::table('site_task')
            ->where('phase_id', $phase)
            ->where('status', '!=', 'Done')
            ->count();

        if ($totalTasks === 0) {
            return response()->json([
                'message' => 'Add at least one task before approving completion.',
            ], 422);
        }

        if ($openTasks > 0) {
            return response()->json([
                'message' => 'Complete all phase tasks before approving completion.',
            ], 422);
        }

        $model = ProjectPhase::findOrFail($phase);
        $model->update([
            'status' => 'Completed',
            'completion_requested_at' => null,
            'completion_requested_by' => null,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Phase completed.',
            'data' => $model->fresh(),
        ]);
    }

    /**
     * Reject a pending supervisor completion request without completing the phase.
     */
    public function rejectPhaseCompletion(Request $request, int $phase): JsonResponse
    {
        $row = $this->phaseFor($this->projectIds($request), $phase);

        if (! $row) {
            return response()->json(['message' => 'Phase not found.'], 404);
        }

        if ($row->status !== 'In Progress' || ! $row->completion_requested_at) {
            return response()->json([
                'message' => 'There is no pending completion request for this phase.',
            ], 422);
        }

        $model = ProjectPhase::findOrFail($phase);
        $model->update([
            'completion_requested_at' => null,
            'completion_requested_by' => null,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Completion request rejected.',
            'data' => $model->fresh(),
        ]);
    }

    /**
     * Resource allocations can never exceed the total approved budget.
     */
    private function assertAllocations(float $approved, float $materials, float $equipment): void
    {
        if (round($materials + $equipment, 2) > round($approved, 2)) {
            throw ValidationException::withMessages([
                'materials_budget' => ['Materials plus equipment allocation cannot exceed the total budget.'],
            ]);
        }
    }

    private function validateProject(Request $request, bool $supervisorRequired = false): array
    {
        $supervisorRoleId = DB::table('role')
            ->where('role_name', Role::SITE_SUPERVISOR)
            ->value('role_id');

        $supervisorRule = Rule::exists('users', 'user_id')
            ->where('role_id', $supervisorRoleId)
            ->where('is_active', true);

        return $request->validate([
            'project_name' => ['required', 'string', 'max:255'],
            'client_name' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'approved_budget' => ['nullable', 'numeric', 'min:0'],
            'materials_budget' => ['nullable', 'numeric', 'min:0'],
            'equipment_budget' => ['nullable', 'numeric', 'min:0'],
            // A project cannot reach the site without a supervisor.
            'site_supervisor_id' => $supervisorRequired
                ? ['required', 'integer', $supervisorRule]
                : ['nullable', 'integer', $supervisorRule],
        ], [
            'site_supervisor_id.required' => 'Assign a Site Supervisor before saving the project.',
            'site_supervisor_id.exists' => 'That account is not an active Site Supervisor.',
        ]);
    }

    public function storePhase(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);

        $projectId = (int) $request->validate([
            'project_id' => ['required', 'integer'],
        ])['project_id'];

        $data = $this->validatePhase($request);

        if (! in_array($projectId, $ids, true)) {
            return response()->json(['message' => 'You cannot add phases to that project.'], 403);
        }

        // Eloquent (not the query builder) so the audit observer fires.
        $phase = ProjectPhase::create([
            'project_id' => $projectId,
            'project_name' => $data['phase_name'],
            'description' => $data['description'] ?? null,
            'sequence_no' => $data['sequence_no'] ?? null,
            'project_cost' => $data['project_cost'] ?? null,
            'materials_budget' => $data['materials_budget'] ?? 0,
            'equipment_budget' => $data['equipment_budget'] ?? 0,
            'planned_start' => $data['planned_start'] ?? null,
            'planned_end' => $data['planned_end'] ?? null,
            'status' => 'Not Started',
            'required_skill_id' => $data['required_skill_id'] ?? null,
            'created_by' => $request->user()->user_id,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Phase created successfully.',
            'data' => $phase,
        ], 201);
    }

    private function costSum(string $type, array $ids): float
    {
        if (empty($ids)) {
            return 0.0;
        }

        if ($type === 'labor') {
            return (float) DB::table('labor_hour_log as lhl')
                ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
                ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
                ->whereIn('ph.project_id', $ids)
                ->sum('lhl.computed_cost');
        }

        if ($type === 'materials') {
            return (float) DB::table('material_usage as mu')
                ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
                ->whereIn('ph.project_id', $ids)
                ->sum('mu.computed_cost');
        }

        return (float) DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->sum('eu.computed_cost');
    }

    private function assignedWorkerCount(array $ids): int
    {
        if (empty($ids)) {
            return 0;
        }

        return (int) DB::table('workforce_assignment as wa')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('wa.status', 'Active')
            ->distinct('wa.laborer_id')
            ->count('wa.laborer_id');
    }

    private function openPhaseCount(array $ids): int
    {
        if (empty($ids)) {
            return 0;
        }

        return (int) DB::table('project_phases')
            ->whereIn('project_id', $ids)
            ->where('status', '!=', 'Completed')
            ->count();
    }

    /**
     * Workers for the selected project. "Available" means not actively
     * assigned to this project; a laborer may still work on another project.
     */
    public function workforce(Request $request): JsonResponse
    {
        $selected = (int) $request->query('project_id', 0);

        if ($selected > 0 && ! in_array($selected, $this->allowedProjectIds($request), true)) {
            return response()->json([
                'message' => 'Project not found.',
            ], 403);
        }

        $ids = $this->projectIds($request);

        $available = DB::table('laborer as l')
            ->where('l.employment_status', 'Active')
            ->when($ids !== [], function ($query) use ($ids) {
                $query->whereNotExists(function ($sub) use ($ids) {
                    $sub->select(DB::raw(1))
                        ->from('workforce_assignment as wa')
                        ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
                        ->whereColumn('wa.laborer_id', 'l.laborer_id')
                        ->where('wa.status', 'Active')
                        ->whereIn('ph.project_id', $ids);
                });
            })
            ->select('l.laborer_id', 'l.first_name', 'l.last_name', 'l.hourly_rate', 'l.employment_status')
            ->orderBy('l.last_name')
            ->get();

        $assigned = empty($ids) ? collect() : DB::table('workforce_assignment as wa')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->whereIn('ph.project_id', $ids)
            ->where('wa.status', 'Active')
            ->select(
                'wa.assignment_id',
                'wa.phase_id',
                'l.laborer_id',
                'l.first_name',
                'l.last_name',
                'l.hourly_rate',
                'l.employment_status',
                'wa.hourly_rate_ovveride',
                'p.project_name as project',
                'ph.project_name as phase',
                'wa.role_on_task',
                'wa.status'
            )
            ->orderBy('l.last_name')
            ->get();

        $skills = DB::table('laborer_skills as ls')
            ->join('skill as s', 's.skill_id', '=', 'ls.skill_id')
            ->select('ls.laborer_id', 's.skill_name')
            ->get()
            ->groupBy('laborer_id')
            ->map(fn ($rows) => $rows->pluck('skill_name')->all());

        return response()->json([
            'available' => $available,
            'assigned' => $assigned,
            'skills' => $skills,
        ]);
    }

    public function skillMatch(Request $request): JsonResponse
    {
        $phaseId = (int) $request->query('phase_id');
        $ids = $this->projectIds($request);
        $phase = DB::table('project_phases')->where('phase_id', $phaseId)->first();

        if (! $phase || ! in_array((int) $phase->project_id, $ids, true)) {
            return response()->json(['message' => 'Phase not found.'], 404);
        }

        if (! $phase->required_skill_id) {
            return response()->json(['phase' => $phase, 'required_skill' => null, 'data' => []]);
        }

        $skillName = DB::table('skill')->where('skill_id', $phase->required_skill_id)->value('skill_name');

        $laborers = DB::table('laborer as l')
            ->join('laborer_skills as ls', 'ls.laborer_id', '=', 'l.laborer_id')
            ->where('ls.skill_id', $phase->required_skill_id)
            ->where('l.employment_status', 'Active')
            ->whereNotExists(function ($sub) use ($phase) {
                $sub->select(DB::raw(1))
                    ->from('workforce_assignment as wa')
                    ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
                    ->whereColumn('wa.laborer_id', 'l.laborer_id')
                    ->where('wa.status', 'Active')
                    ->where('ph.project_id', $phase->project_id);
            })
            ->select('l.laborer_id', 'l.first_name', 'l.last_name', 'l.hourly_rate', 'l.employment_status')
            ->distinct()
            ->orderBy('l.last_name')
            ->get();

        return response()->json([
            'phase' => $phase,
            'required_skill' => $skillName,
            'data' => $laborers,
        ]);
    }

    /**
     * Read-only skill list so a PM can set a phase's required skill.
     * (The Admin-owned /skills CRUD stays closed to Project Managers.)
     */
    public function skills(): JsonResponse
    {
        return response()->json([
            'data' => DB::table('skill')
                ->select('skill_id', 'skill_name', 'description')
                ->orderBy('skill_name')
                ->get(),
        ]);
    }

    /**
     * Site Supervisors a PM can assign to projects, plus the directory view.
     * Defaults to active accounts; `include_inactive=1` returns the full list.
     */
    public function siteSupervisors(Request $request): JsonResponse
    {
        $roleId = DB::table('role')
            ->where('role_name', Role::SITE_SUPERVISOR)
            ->value('role_id');

        $query = DB::table('users')->where('role_id', $roleId);

        if (! $request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        $rows = $query
            ->orderBy('last_name')
            ->get(['user_id', 'id_number', 'first_name', 'last_name', 'email', 'is_active'])
            ->map(fn ($user) => [
                'user_id' => (int) $user->user_id,
                'id_number' => $user->id_number,
                'name' => trim(($user->first_name ?? '').' '.($user->last_name ?? '')),
                'email' => $user->email,
                'is_active' => (bool) $user->is_active,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Assign a laborer to one of the PM's own phases.
     */
    public function storeAssignment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'laborer_id' => ['required', 'integer', Rule::exists('laborer', 'laborer_id')],
            'phase_id' => ['required', 'integer', Rule::exists('project_phases', 'phase_id')],
            'role_on_task' => ['nullable', 'string', 'max:100'],
            'hourly_rate_ovveride' => ['nullable', 'numeric', 'gt:0', 'max:9999999999999.99'],
        ]);

        $phase = DB::table('project_phases')->where('phase_id', $data['phase_id'])->first();

        if (! $phase || ! in_array((int) $phase->project_id, $this->projectIds($request), true)) {
            return response()->json([
                'message' => 'You can only assign laborers to phases in your own projects.',
            ], 403);
        }

        $laborer = DB::table('laborer')->where('laborer_id', $data['laborer_id'])->first();

        if (! $laborer || $laborer->employment_status !== 'Active') {
            throw ValidationException::withMessages([
                'laborer_id' => 'Only active laborers can be assigned to a phase.',
            ]);
        }

        $duplicate = DB::table('workforce_assignment as wa')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->where('wa.laborer_id', $data['laborer_id'])
            ->where('ph.project_id', $phase->project_id)
            ->where('wa.status', 'Active')
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'phase_id' => 'This laborer is already actively assigned to a phase in this project. Remove that assignment before assigning another phase.',
            ]);
        }

        $assignment = WorkforceAssignment::create([
            'laborer_id' => $data['laborer_id'],
            'phase_id' => $data['phase_id'],
            'assigned_at' => now(),
            'role_on_task' => $data['role_on_task'] ?? null,
            'status' => 'Active',
            'hourly_rate_ovveride' => $data['hourly_rate_ovveride'] ?? null,
            'created_by' => $request->user()->user_id,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Laborer assigned to the phase.',
            'data' => $assignment,
        ], 201);
    }

    /**
     * Remove a laborer from a phase (blocked once hours have been logged).
     */
    public function destroyAssignment(Request $request, int $assignment): JsonResponse
    {
        $row = DB::table('workforce_assignment')->where('assignment_id', $assignment)->first();

        if (! $row) {
            return response()->json(['message' => 'Assignment not found.'], 404);
        }

        $phase = DB::table('project_phases')->where('phase_id', $row->phase_id)->first();

        if (! $phase || ! in_array((int) $phase->project_id, $this->projectIds($request), true)) {
            return response()->json([
                'message' => 'You can only manage assignments in your own projects.',
            ], 403);
        }

        $loggedHours = DB::table('labor_hour_log')->where('assignment_id', $assignment)->count();

        if ($loggedHours > 0) {
            return response()->json([
                'message' => 'This laborer already logged hours on this phase, so the assignment cannot be removed.',
            ], 422);
        }

        $openTasks = DB::table('site_task')
            ->where('phase_id', $row->phase_id)
            ->where('assigned_laborer_id', $row->laborer_id)
            ->whereIn('status', ['Pending', 'In Progress'])
            ->count();

        if ($openTasks > 0) {
            return response()->json([
                'message' => 'This laborer has open tasks on this phase. Reassign or complete those tasks before removing the assignment.',
            ], 422);
        }

        WorkforceAssignment::whereKey($assignment)->delete();

        return response()->json(['message' => 'Laborer removed from the phase.']);
    }

    /**
     * Update one of the PM's own phases.
     */
    public function updatePhase(Request $request, int $phase): JsonResponse
    {
        $row = DB::table('project_phases')->where('phase_id', $phase)->first();

        if (! $row || ! in_array((int) $row->project_id, $this->projectIds($request), true)) {
            return response()->json([
                'message' => 'You can only edit phases in your own projects.',
            ], 403);
        }

        $data = $this->validatePhase($request);
        $model = ProjectPhase::findOrFail($phase);

        $model->update([
            'project_name' => $data['phase_name'],
            'description' => $data['description'] ?? null,
            'sequence_no' => $data['sequence_no'] ?? null,
            'project_cost' => $data['project_cost'] ?? null,
            'materials_budget' => $data['materials_budget'] ?? 0,
            'equipment_budget' => $data['equipment_budget'] ?? 0,
            'planned_start' => $data['planned_start'] ?? null,
            'planned_end' => $data['planned_end'] ?? null,
            'required_skill_id' => $data['required_skill_id'] ?? null,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Phase updated successfully.',
            'data' => $model->fresh(),
        ]);
    }

    /**
     * Delete an unused phase from one of the PM's projects.
     */
    public function destroyPhase(Request $request, int $phase): JsonResponse
    {
        $row = DB::table('project_phases')->where('phase_id', $phase)->first();

        if (! $row || ! in_array((int) $row->project_id, $this->projectIds($request), true)) {
            return response()->json([
                'message' => 'You can only delete phases in your own projects.',
            ], 403);
        }

        $assignments = DB::table('workforce_assignment')->where('phase_id', $phase)->count();

        if ($assignments > 0) {
            return response()->json([
                'message' => 'This phase still has laborers assigned and cannot be deleted.',
            ], 422);
        }

        $usage = DB::table('material_usage')->where('phase_id', $phase)->count()
            + DB::table('equipment_usage')->where('phase_id', $phase)->count();

        if ($usage > 0) {
            return response()->json([
                'message' => 'This phase has material or equipment usage logged and cannot be deleted.',
            ], 422);
        }

        ProjectPhase::findOrFail($phase)->delete();

        return response()->json(['message' => 'Phase deleted successfully.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePhase(Request $request): array
    {
        return $request->validate([
            'phase_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
            'sequence_no' => ['nullable', 'integer', 'min:1'],
            'project_cost' => ['nullable', 'numeric', 'min:0'],
            'materials_budget' => ['nullable', 'numeric', 'min:0'],
            'equipment_budget' => ['nullable', 'numeric', 'min:0'],
            'planned_start' => ['nullable', 'date'],
            'planned_end' => ['nullable', 'date'],
            'required_skill_id' => ['nullable', 'integer', Rule::exists('skill', 'skill_id')],
        ]);
    }

    /**
     * Full material catalog (for the "log material" form).
     */
    public function materialCatalog(Request $request): JsonResponse
    {
        $rows = DB::table('materials')
            ->orderBy('material_name')
            ->get(['material_id', 'material_name', 'unit_of_measure', 'unit_cost', 'stock_quantity'])
            ->map(fn ($row) => [
                'material_id' => (int) $row->material_id,
                'material_name' => $row->material_name,
                'unit_of_measure' => $row->unit_of_measure,
                'unit_cost' => (float) $row->unit_cost,
                'stock_quantity' => (int) $row->stock_quantity,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Full equipment catalog (for the "log equipment" form).
     */
    public function equipmentCatalog(Request $request): JsonResponse
    {
        $rows = DB::table('equipment')
            ->orderBy('equipment_name')
            ->get(['equipment_id', 'equipment_name', 'equipment_type', 'hourly_rental_rate', 'equipment_status'])
            ->map(fn ($row) => [
                'equipment_id' => (int) $row->equipment_id,
                'equipment_name' => $row->equipment_name,
                'equipment_type' => $row->equipment_type,
                'hourly_rental_rate' => (float) $row->hourly_rental_rate,
                'equipment_status' => $row->equipment_status,
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * Material usage entries for the selected project (detail popup table).
     */
    public function materialUsage(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->materialUsageQuery($this->projectIds($request))]);
    }

    /**
     * Log material usage from the PM console.
     */
    public function storeMaterialUsage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'material_id' => ['required', 'integer'],
            'phase_id' => ['required', 'integer'],
            'usage_date' => ['required', 'date', 'before_or_equal:today'],
            'quantity_used' => ['required', 'numeric', 'min:0.01', 'max:100000'],
        ]);

        $phase = $this->phaseFor($this->projectIds($request), (int) $data['phase_id']);

        if (! $phase) {
            return response()->json(['message' => 'That phase does not belong to your project.'], 403);
        }

        $material = Material::find($data['material_id']);

        if (! $material) {
            return response()->json(['message' => 'Unknown material.'], 422);
        }

        $quantity = round((float) $data['quantity_used'], 2);

        if ($quantity > (float) $material->stock_quantity) {
            return response()->json([
                'message' => 'Only '.$this->stockLabel($material).' of '.$material->material_name.' remain in stock.',
            ], 422);
        }

        DB::transaction(function () use ($data, $quantity, $phase, $material, $request) {
            $lockedMaterial = Material::query()->lockForUpdate()->find($material->material_id);

            if (! $lockedMaterial) {
                throw ValidationException::withMessages([
                    'material_id' => 'Unknown material.',
                ]);
            }

            if ($quantity > (float) $lockedMaterial->stock_quantity) {
                throw ValidationException::withMessages([
                    'quantity_used' => 'Only '.$this->stockLabel($lockedMaterial).' of '.$lockedMaterial->material_name.' remain in stock.',
                ]);
            }

            MaterialUsage::create([
                'material_id' => $lockedMaterial->material_id,
                'phase_id' => $phase->phase_id,
                'usage_date' => $data['usage_date'],
                'quantity_used' => $quantity,
                'unit_cost_at_use' => (float) $lockedMaterial->unit_cost,
                'created_by' => $request->user()->user_id,
                'updated_by' => $request->user()->user_id,
            ]);

            $this->adjustMaterialStock((int) $lockedMaterial->material_id, -$quantity);
        });

        return response()->json([
            'message' => 'Material usage logged.',
            'data' => [
                'material' => $material->material_name,
                'quantity_used' => $quantity,
                'unit' => $material->unit_of_measure,
            ],
        ], 201);
    }

    /**
     * Void a material entry (refunds stock and budget).
     */
    public function destroyMaterialUsage(Request $request, int $id): JsonResponse
    {
        $usage = MaterialUsage::find($id);

        if (! $usage) {
            return response()->json(['message' => 'Material log not found.'], 404);
        }

        $phase = $this->phaseFor($this->projectIds($request), (int) $usage->phase_id);

        if (! $phase) {
            return response()->json(['message' => 'You can only void logs from your own project.'], 403);
        }

        DB::transaction(function () use ($usage) {
            $this->adjustMaterialStock((int) $usage->material_id, (float) $usage->quantity_used);

            $usage->delete();
        });

        return response()->json(['message' => 'Material log voided, stock and budget refunded.']);
    }

    /**
     * Materials consumed on the selected project (aggregated).
     */
    public function materials(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);

        $used = DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('mu.material_id')
            ->select('mu.material_id', DB::raw('SUM(mu.quantity_used) as used_quantity'))
            ->pluck('used_quantity', 'material_id');

        if ($used->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $materials = DB::table('materials as m')
            ->leftJoin('materials_suppliers as ms', 'ms.material_id', '=', 'm.material_id')
            ->leftJoin('suppliers as s', 's.supplier_id', '=', 'ms.supplier_id')
            ->whereIn('m.material_id', $used->keys()->all())
            ->select(
                'm.material_id',
                'm.material_name',
                'm.unit_of_measure',
                'm.unit_cost',
                'm.stock_quantity',
                DB::raw('MIN(s.supplier_name) as supplier_name')
            )
            ->groupBy('m.material_id', 'm.material_name', 'm.unit_of_measure', 'm.unit_cost', 'm.stock_quantity')
            ->orderBy('m.material_name')
            ->get()
            ->map(fn ($row) => [
                'material_id' => (int) $row->material_id,
                'material_name' => $row->material_name,
                'unit_of_measure' => $row->unit_of_measure,
                'unit_cost' => (float) $row->unit_cost,
                'stock_quantity' => (int) $row->stock_quantity,
                'supplier_name' => $row->supplier_name,
                'used_quantity' => (float) ($used[$row->material_id] ?? 0),
            ])
            ->values();

        return response()->json(['data' => $materials]);
    }

    /**
     * Equipment usage entries for the selected project.
     */
    public function equipmentUsage(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->equipmentUsageQuery($this->projectIds($request))]);
    }

    /**
     * Log equipment usage from the PM console.
     */
    public function storeEquipmentUsage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'equipment_id' => ['required', 'integer'],
            'phase_id' => ['required', 'integer'],
            'usage_date' => ['required', 'date', 'before_or_equal:today'],
            'hours_used' => ['required', 'numeric', 'min:0.01', 'max:24'],
        ]);

        $phase = $this->phaseFor($this->projectIds($request), (int) $data['phase_id']);

        if (! $phase) {
            return response()->json(['message' => 'That phase does not belong to your project.'], 403);
        }

        $equipment = DB::table('equipment')->where('equipment_id', $data['equipment_id'])->first();

        if (! $equipment) {
            return response()->json(['message' => 'Unknown equipment.'], 422);
        }

        if ($equipment->equipment_status === 'Under Maintenance') {
            return response()->json([
                'message' => 'This equipment is under maintenance and cannot be used.',
            ], 422);
        }

        $hours = round((float) $data['hours_used'], 2);
        DB::transaction(function () use ($data, $hours, $phase, $equipment, $request) {
            EquipmentUsage::create([
                'equipment_id' => $equipment->equipment_id,
                'phase_id' => $phase->phase_id,
                'usage_date' => $data['usage_date'],
                'hours_used' => $hours,
                'hourly_rate_at_use' => (float) $equipment->hourly_rental_rate,
                'created_by' => $request->user()->user_id,
                'updated_by' => $request->user()->user_id,
            ]);
        });

        return response()->json([
            'message' => 'Equipment usage logged.',
            'data' => [
                'equipment' => $equipment->equipment_name,
                'hours_used' => $hours,
            ],
        ], 201);
    }

    /**
     * Void an equipment entry (refunds the project budget).
     */
    public function destroyEquipmentUsage(Request $request, int $id): JsonResponse
    {
        $usage = EquipmentUsage::find($id);

        if (! $usage) {
            return response()->json(['message' => 'Equipment log not found.'], 404);
        }

        $phase = $this->phaseFor($this->projectIds($request), (int) $usage->phase_id);

        if (! $phase) {
            return response()->json(['message' => 'You can only void logs from your own project.'], 403);
        }

        DB::transaction(function () use ($usage) {
            $usage->delete();
        });

        return response()->json(['message' => 'Equipment log voided and the budget refunded.']);
    }

    /**
     * Equipment deployed on the selected project.
     */
    public function equipment(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $idList = implode(',', array_map('intval', $ids));

        $hours = DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('eu.equipment_id')
            ->select('eu.equipment_id', DB::raw('SUM(eu.hours_used) as hours_used'))
            ->pluck('hours_used', 'equipment_id');

        if ($hours->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $equipment = DB::table('equipment as e')
            ->whereIn('e.equipment_id', $hours->keys()->all())
            ->select(
                'e.equipment_id',
                'e.equipment_name',
                'e.equipment_type',
                'e.hourly_rental_rate',
                'e.equipment_status',
                DB::raw('(SELECT p.project_name FROM equipment_usage eu JOIN project_phases ph ON ph.phase_id = eu.phase_id JOIN projects p ON p.project_id = ph.project_id WHERE eu.equipment_id = e.equipment_id AND ph.project_id IN ('.$idList.') ORDER BY eu.usage_date DESC LIMIT 1) as assigned_project')
            )
            ->orderBy('e.equipment_name')
            ->get()
            ->map(fn ($row) => [
                'equipment_id' => (int) $row->equipment_id,
                'equipment_name' => $row->equipment_name,
                'equipment_type' => $row->equipment_type,
                'hourly_rental_rate' => (float) $row->hourly_rental_rate,
                'equipment_status' => $row->equipment_status,
                'assigned_project' => $row->assigned_project,
                'used_hours' => (float) ($hours[$row->equipment_id] ?? 0),
            ])
            ->values();

        return response()->json(['data' => $equipment]);
    }    public function assignments(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);

        if (empty($ids)) {
            return response()->json(['data' => []]);
        }

        $assignments = DB::table('workforce_assignment as wa')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->whereIn('ph.project_id', $ids)
            ->select(
                'wa.assignment_id',
                'wa.laborer_id',
                'ph.phase_id',
                'l.first_name',
                'l.last_name',
                'p.project_name as project',
                'ph.project_name as phase',
                'wa.role_on_task',
                'wa.status',
                'wa.assigned_at',
                'wa.released_at',
                'wa.hourly_rate_ovveride'
            )
            ->orderByDesc('wa.assignment_id')
            ->get();

        return response()->json(['data' => $assignments]);
    }

    public function budgets(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);

        // Resource allocations live on the project row; spend is aggregated from
        // the usage tables so the finance page can show one clean breakdown.
        $resources = DB::table('projects')
            ->whereIn('project_id', $ids)
            ->get(['project_id', 'materials_budget', 'equipment_budget'])
            ->keyBy('project_id');

        $materialSpend = DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('ph.project_id')
            ->select('ph.project_id', DB::raw('SUM(mu.computed_cost) as spent'))
            ->pluck('spent', 'project_id');

        $equipmentSpend = DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('ph.project_id')
            ->select('ph.project_id', DB::raw('SUM(eu.computed_cost) as spent'))
            ->pluck('spent', 'project_id');

        $data = $this->projectsFor($request)
            ->map(function ($project) use ($resources, $materialSpend, $equipmentSpend) {
                $resource = $resources[$project['project_id']] ?? null;
                $materialsBudget = round((float) ($resource->materials_budget ?? 0), 2);
                $materialsSpent = round((float) ($materialSpend[$project['project_id']] ?? 0), 2);
                $equipmentBudget = round((float) ($resource->equipment_budget ?? 0), 2);
                $equipmentSpent = round((float) ($equipmentSpend[$project['project_id']] ?? 0), 2);

                return [
                    'project_id' => $project['project_id'],
                    'project' => $project['project_name'],
                    'approved' => $project['approved_budget'],
                    'spent' => $project['spent_budget'],
                    'remaining' => $project['remaining_budget'],
                    'utilization' => $project['utilization'],
                    'materials_budget' => $materialsBudget,
                    'materials_spent' => $materialsSpent,
                    'materials_remaining' => round($materialsBudget - $materialsSpent, 2),
                    'equipment_budget' => $equipmentBudget,
                    'equipment_spent' => $equipmentSpent,
                    'equipment_remaining' => round($equipmentBudget - $equipmentSpent, 2),
                ];
            })
            ->values();

        return response()->json(['data' => $data]);
    }

    public function costReport(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $labor = $this->costSum('labor', $ids);
        $materials = $this->costSum('materials', $ids);
        $equipment = $this->costSum('equipment', $ids);
        $actual = $labor + $materials + $equipment;

        $approved = (float) DB::table('projects')->whereIn('project_id', $ids)->sum('approved_budget');
        $remaining = (float) DB::table('projects')->whereIn('project_id', $ids)->sum('remaining_budget');

        return response()->json([
            'categories' => [
                ['category' => 'Labor', 'actual' => $labor],
                ['category' => 'Materials', 'actual' => $materials],
                ['category' => 'Equipment', 'actual' => $equipment],
            ],
            'totals' => [
                'approved' => $approved,
                'actual' => $actual,
                'remaining' => $remaining,
                'variance' => $approved - $actual,
                'utilization' => $approved > 0 ? (int) round(($actual / $approved) * 100) : 0,
            ],
        ]);
    }

    /**
     * Cost breakdown per phase (labor / materials / equipment / total).
     */
    public function phaseCosts(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);

        if (empty($ids)) {
            return response()->json(['data' => []]);
        }

        $labor = DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('wa.phase_id')
            ->select('wa.phase_id', DB::raw('SUM(lhl.computed_cost) as amount'))
            ->pluck('amount', 'phase_id');

        $materials = DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('mu.phase_id')
            ->select('mu.phase_id', DB::raw('SUM(mu.computed_cost) as amount'))
            ->pluck('amount', 'phase_id');

        $equipment = DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('eu.phase_id')
            ->select('eu.phase_id', DB::raw('SUM(eu.computed_cost) as amount'))
            ->pluck('amount', 'phase_id');

        $rows = DB::table('project_phases')
            ->whereIn('project_id', $ids)
            ->orderBy('sequence_no')
            ->orderBy('phase_id')
            ->get(['phase_id', 'project_name', 'sequence_no', 'status'])
            ->map(function ($row) use ($labor, $materials, $equipment) {
                $laborCost = (float) ($labor[$row->phase_id] ?? 0);
                $materialCost = (float) ($materials[$row->phase_id] ?? 0);
                $equipmentCost = (float) ($equipment[$row->phase_id] ?? 0);

                return [
                    'phase_id' => (int) $row->phase_id,
                    'phase' => $row->project_name,
                    'sequence' => (int) $row->sequence_no,
                    'status' => $row->status,
                    'labor' => round($laborCost, 2),
                    'materials' => round($materialCost, 2),
                    'equipment' => round($equipmentCost, 2),
                    'total' => round($laborCost + $materialCost + $equipmentCost, 2),
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function balance(Request $request): JsonResponse
    {
        $data = $this->projectsFor($request)
            ->map(fn ($project) => [
                'project_id' => $project['project_id'],
                'project' => $project['project_name'],
                'approved' => $project['approved_budget'],
                'spent' => $project['spent_budget'],
                'remaining' => $project['remaining_budget'],
                'utilization' => $project['utilization'],
            ])
            ->values();

        return response()->json(['data' => $data]);
    }

    public function search(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));
        $ids = $this->projectIds($request);

        if ($term === '' || empty($ids)) {
            return response()->json(['projects' => [], 'phases' => [], 'laborers' => []]);
        }

        $like = '%'.$term.'%';

        $projects = DB::table('projects')
            ->whereIn('project_id', $ids)
            ->where(function ($query) use ($like) {
                $query->where('project_name', 'like', $like)
                    ->orWhere('client_name', 'like', $like)
                    ->orWhere('location', 'like', $like);
            })
            ->get(['project_id', 'project_name', 'client_name', 'location', 'status']);

        $phases = DB::table('project_phases as ph')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->whereIn('ph.project_id', $ids)
            ->where(function ($query) use ($like) {
                $query->where('ph.project_name', 'like', $like)
                    ->orWhere('p.project_name', 'like', $like)
                    ->orWhere('ph.description', 'like', $like);
            })
            ->get(['ph.phase_id', 'ph.project_id', 'p.project_name as project', 'ph.project_name', 'ph.status']);

        $laborers = DB::table('laborer as l')
            ->where(function ($query) use ($like) {
                $query->where('l.first_name', 'like', $like)
                    ->orWhere('l.last_name', 'like', $like);
            })
            ->limit(20)
            ->get(['l.laborer_id', 'l.first_name', 'l.last_name', 'l.hourly_rate', 'l.employment_status']);

        return response()->json([
            'projects' => $projects,
            'phases' => $phases,
            'laborers' => $laborers,
        ]);
    }
}