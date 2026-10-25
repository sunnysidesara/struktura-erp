<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\Material;
use App\Support\ProjectBudget;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    private const EQUIPMENT_STATUSES = ['Available', 'In Use', 'Under Maintenance'];
    private const EQUIPMENT_TRANSITIONS = [
        'Available' => ['In Use', 'Under Maintenance'],
        'In Use' => ['Available', 'Under Maintenance'],
        'Under Maintenance' => ['Available'],
    ];

    public function dashboard(): JsonResponse
    {
        $roleCounts = DB::table('users')
            ->join('role', 'role.role_id', '=', 'users.role_id')
            ->select('role.role_name', DB::raw('COUNT(*) as total'))
            ->groupBy('role.role_name')
            ->pluck('total', 'role_name');

        $activity = DB::table('audit_logs')
            ->select(DB::raw('DATE(charge_at) as day'), DB::raw('COUNT(*) as total'))
            ->where('charge_at', '>=', now()->subDays(29)->startOfDay())
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $recent = DB::table('audit_logs as a')
            ->leftJoin('projects as p', 'p.project_id', '=', 'a.project_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'a.changed_by')
            ->orderByDesc('a.charge_at')
            ->limit(10)
            ->get([
                'a.audit_log_id as id',
                'a.table_name',
                'a.record_id',
                'a.action_type',
                'a.charge_at',
                'p.project_name',
                'u.id_number',
                'u.first_name',
                'u.last_name',
            ]);

        return response()->json([
            'metrics' => [
                'total_users' => DB::table('users')->count(),
                'active_users' => DB::table('users')->where('is_active', 1)->count(),
                'skills' => DB::table('skill')->count(),
                'projects' => DB::table('projects')->count(),
                'audit_events_today' => DB::table('audit_logs')->whereDate('charge_at', now()->toDateString())->count(),
                'active_sessions' => DB::table('personal_access_tokens')->count(),
            ],
            'roles' => [
                'Admin' => (int) ($roleCounts['Admin'] ?? 0),
                'Project Manager' => (int) ($roleCounts['Project Manager'] ?? 0),
                'Site Supervisor' => (int) ($roleCounts['Site Supervisor'] ?? 0),
            ],
            'activity' => $activity,
            'recent' => $recent,
        ]);
    }

    public function projects(): JsonResponse
    {
        $projects = DB::table('projects as p')
            ->leftJoin('users as u', 'u.user_id', '=', 'p.user_id')
            ->select(
                'p.project_id',
                'p.project_name',
                'p.client_name',
                'p.location',
                'p.start_date',
                'p.end_date',
                'p.approved_budget',
                'p.remaining_budget',
                'p.deadline',
                'p.status',
                'u.id_number as manager_id',
                'u.first_name as manager_first_name',
                'u.last_name as manager_last_name',
                DB::raw('(SELECT COUNT(*) FROM project_phases ph WHERE ph.project_id = p.project_id) as phase_count')
            )
            ->orderBy('p.project_id')
            ->get();

        $ids = $projects->pluck('project_id')->all();

        // Recorded costs from the three usage streams (one row per project).
        $laborCosts = empty($ids) ? collect() : DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('ph.project_id')
            ->select('ph.project_id', DB::raw('SUM(COALESCE(lhl.computed_cost, 0)) as recorded'))
            ->pluck('recorded', 'project_id');

        $materialCosts = empty($ids) ? collect() : DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('ph.project_id')
            ->select('ph.project_id', DB::raw('SUM(COALESCE(mu.computed_cost, 0)) as recorded'))
            ->pluck('recorded', 'project_id');

        $equipmentCosts = empty($ids) ? collect() : DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->groupBy('ph.project_id')
            ->select('ph.project_id', DB::raw('SUM(COALESCE(eu.computed_cost, 0)) as recorded'))
            ->pluck('recorded', 'project_id');

        $projects = $projects->map(function ($project) use ($laborCosts, $materialCosts, $equipmentCosts) {
            $recorded = (float) ($laborCosts[$project->project_id] ?? 0)
                + (float) ($materialCosts[$project->project_id] ?? 0)
                + (float) ($equipmentCosts[$project->project_id] ?? 0);

            $summary = ProjectBudget::summarize(
                (float) $project->approved_budget,
                (float) $project->remaining_budget,
                $recorded,
            );

            $project->spent_budget = $summary['spent_budget'];
            $project->utilization = $summary['utilization'];
            $project->recorded_costs = $summary['recorded_costs'];

            return $project;
        });

        return response()->json(['data' => $projects]);
    }

    public function phases(): JsonResponse
    {
        $phases = DB::table('project_phases as ph')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->select(
                'ph.phase_id',
                'ph.project_id',
                'p.project_name as project',
                'ph.project_name',
                'ph.description',
                'ph.sequence_no',
                'ph.project_cost',
                'ph.planned_start',
                'ph.planned_end',
                'ph.status'
            )
            ->orderBy('ph.project_id')
            ->orderBy('ph.sequence_no')
            ->get();

        return response()->json(['data' => $phases]);
    }

    public function assignments(): JsonResponse
    {
        $assignments = DB::table('workforce_assignment as wa')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->select(
                'wa.assignment_id',
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

    public function resources(): JsonResponse
    {
        return response()->json([
            'equipment' => DB::table('equipment as e')
                ->select('e.*')
                ->selectRaw('(SELECT COUNT(*) FROM equipment_usage eu WHERE eu.equipment_id = e.equipment_id) as usage_count')
                ->orderBy('e.equipment_name')
                ->get()
                ->map(function ($row) {
                    $row->usage_count = (int) $row->usage_count;

                    return $row;
                }),
            'materials' => DB::table('materials as m')
                ->select('m.*')
                ->selectRaw('(SELECT COUNT(*) FROM material_usage mu WHERE mu.material_id = m.material_id) as usage_count')
                ->orderBy('m.material_name')
                ->get()
                ->map(function ($row) {
                    $row->usage_count = (int) $row->usage_count;

                    return $row;
                }),
            'suppliers' => DB::table('suppliers')->orderBy('supplier_name')->get(),
        ]);
    }

    public function storeMaterial(Request $request): JsonResponse
    {
        $material = Material::create($this->materialData($request) + [
            'created_by' => $request->user()->user_id,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Material created successfully.',
            'data' => $material,
        ], 201);
    }

    public function updateMaterial(Request $request, int $material): JsonResponse
    {
        $model = Material::findOrFail($material);
        $model->update($this->materialData($request, $material) + [
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Material updated successfully.',
            'data' => $model->fresh(),
        ]);
    }

    public function destroyMaterial(int $material): JsonResponse
    {
        $model = Material::findOrFail($material);

        if (DB::table('material_usage')->where('material_id', $model->material_id)->exists()) {
            return response()->json([
                'message' => 'This material has usage records and cannot be deleted.',
            ], 422);
        }

        $model->delete();

        return response()->json(['message' => 'Material deleted successfully.']);
    }

    public function storeEquipment(Request $request): JsonResponse
    {
        $equipment = Equipment::create($this->equipmentData($request) + [
            'equipment_status' => 'Available',
            'created_by' => $request->user()->user_id,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Equipment created successfully.',
            'data' => $equipment,
        ], 201);
    }

    public function updateEquipment(Request $request, int $equipment): JsonResponse
    {
        $model = Equipment::findOrFail($equipment);
        $model->update($this->equipmentData($request, $equipment) + [
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Equipment updated successfully.',
            'data' => $model->fresh(),
        ]);
    }

    public function changeEquipmentStatus(Request $request, int $equipment): JsonResponse
    {
        $model = Equipment::findOrFail($equipment);
        $data = $request->validate([
            'status' => ['required', Rule::in(self::EQUIPMENT_STATUSES)],
        ]);

        $current = $model->equipment_status ?? 'Available';
        $allowed = self::EQUIPMENT_TRANSITIONS[$current] ?? [];

        if (! in_array($data['status'], $allowed, true)) {
            return response()->json([
                'message' => 'Equipment status cannot move from '.$current.' to '.$data['status'].'.',
            ], 422);
        }

        $model->update([
            'equipment_status' => $data['status'],
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Equipment marked '.$data['status'].'.',
            'data' => $model->fresh(),
        ]);
    }

    public function destroyEquipment(int $equipment): JsonResponse
    {
        $model = Equipment::findOrFail($equipment);

        if (DB::table('equipment_usage')->where('equipment_id', $model->equipment_id)->exists()) {
            return response()->json([
                'message' => 'This equipment has usage records and cannot be deleted.',
            ], 422);
        }

        $model->delete();

        return response()->json(['message' => 'Equipment deleted successfully.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function materialData(Request $request, ?int $materialId = null): array
    {
        if (is_string($request->input('material_name'))) {
            $request->merge(['material_name' => trim($request->input('material_name'))]);
        }

        if (is_string($request->input('unit_of_measure'))) {
            $request->merge(['unit_of_measure' => trim($request->input('unit_of_measure'))]);
        }

        return $request->validate([
            'material_name' => [
                'required', 'string', 'max:255',
                Rule::unique('materials', 'material_name')->ignore($materialId, 'material_id'),
            ],
            'unit_of_measure' => ['nullable', 'string', 'max:50'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'stock_quantity' => ['required', 'integer', 'min:0'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function equipmentData(Request $request, ?int $equipmentId = null): array
    {
        if (is_string($request->input('equipment_name'))) {
            $request->merge(['equipment_name' => trim($request->input('equipment_name'))]);
        }

        if (is_string($request->input('equipment_type'))) {
            $request->merge(['equipment_type' => trim($request->input('equipment_type'))]);
        }

        return $request->validate([
            'equipment_name' => [
                'required', 'string', 'max:255',
                Rule::unique('equipment', 'equipment_name')->ignore($equipmentId, 'equipment_id'),
            ],
            'equipment_type' => ['nullable', 'string', 'max:100'],
            'hourly_rental_rate' => ['required', 'numeric', 'min:0'],
        ]);
    }

    public function auditEvents(): JsonResponse
    {
        $events = DB::table('audit_logs as a')
            ->leftJoin('projects as p', 'p.project_id', '=', 'a.project_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'a.changed_by')
            ->select(
                'a.audit_log_id',
                'a.project_id',
                'p.project_name',
                'a.table_name',
                'a.record_id',
                'a.action_type',
                'a.old_value',
                'a.new_value',
                'a.charge_at',
                'u.id_number',
                'u.first_name',
                'u.last_name'
            )
            ->orderByDesc('a.charge_at')
            ->limit(200)
            ->get();

        return response()->json(['data' => $events]);
    }

    public function auditLogins(): JsonResponse
    {
        $logins = DB::table('login_history as l')
            ->leftJoin('users as u', 'u.user_id', '=', 'l.user_id')
            ->select(
                'l.id',
                'l.ip_address',
                'l.user_agent',
                'l.status',
                'l.created_at',
                'u.id_number',
                'u.first_name',
                'u.last_name'
            )
            ->orderByDesc('l.created_at')
            ->limit(200)
            ->get();

        return response()->json(['data' => $logins]);
    }

    public function search(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));

        if ($term === '') {
            return response()->json([
                'users' => [],
                'skills' => [],
                'projects' => [],
                'phases' => [],
                'assignments' => [],
                'materials' => [],
                'equipment' => [],
            ]);
        }

        $like = '%'.$term.'%';

        $users = DB::table('users')
            ->where(function ($query) use ($like) {
                $query->where('id_number', 'like', $like)
                    ->orWhere('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('email', 'like', $like);
            })
            ->limit(20)
            ->get(['user_id', 'id_number', 'first_name', 'last_name', 'email', 'is_active']);

        $skills = DB::table('skill')
            ->where('skill_name', 'like', $like)
            ->limit(20)
            ->get();

        $projects = DB::table('projects')
            ->where(function ($query) use ($like) {
                $query->where('project_name', 'like', $like)
                    ->orWhere('client_name', 'like', $like)
                    ->orWhere('location', 'like', $like);
            })
            ->limit(20)
            ->get(['project_id', 'project_name', 'client_name', 'location', 'status']);

        $phases = DB::table('project_phases as ph')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->where(function ($query) use ($like) {
                $query->where('ph.project_name', 'like', $like)
                    ->orWhere('ph.description', 'like', $like)
                    ->orWhere('p.project_name', 'like', $like);
            })
            ->orderBy('ph.phase_id')
            ->limit(20)
            ->get([
                'ph.phase_id',
                'ph.project_id',
                'ph.project_name as phase_name',
                'p.project_name as project',
                'ph.description',
                'ph.status',
            ])
            ->map(fn ($row) => [
                'phase_id' => (int) $row->phase_id,
                'project_id' => (int) $row->project_id,
                'phase_name' => $row->phase_name,
                'project' => $row->project,
                'description' => $row->description,
                'status' => $row->status,
            ]);

        $assignments = DB::table('workforce_assignment as wa')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->where(function ($query) use ($like) {
                $query->where('l.first_name', 'like', $like)
                    ->orWhere('l.last_name', 'like', $like)
                    ->orWhere('ph.project_name', 'like', $like)
                    ->orWhere('p.project_name', 'like', $like)
                    ->orWhere('wa.role_on_task', 'like', $like);
            })
            ->orderBy('wa.assignment_id')
            ->limit(20)
            ->get([
                'wa.assignment_id',
                'l.first_name',
                'l.last_name',
                'p.project_name as project',
                'ph.project_name as phase',
                'wa.role_on_task',
                'wa.status',
            ])
            ->map(fn ($row) => [
                'assignment_id' => (int) $row->assignment_id,
                'worker' => trim($row->first_name.' '.$row->last_name),
                'project' => $row->project,
                'phase' => $row->phase,
                'role_on_task' => $row->role_on_task,
                'status' => $row->status,
            ]);

        $materials = DB::table('materials')
            ->where(function ($query) use ($like) {
                $query->where('material_name', 'like', $like)
                    ->orWhere('unit_of_measure', 'like', $like);
            })
            ->orderBy('material_name')
            ->limit(20)
            ->get([
                'material_id',
                'material_name',
                'unit_of_measure',
                'unit_cost',
                'stock_quantity',
            ])
            ->map(fn ($row) => [
                'material_id' => (int) $row->material_id,
                'material_name' => $row->material_name,
                'unit_of_measure' => $row->unit_of_measure,
                'unit_cost' => $row->unit_cost !== null ? (float) $row->unit_cost : null,
                'stock_quantity' => (int) $row->stock_quantity,
            ]);

        $equipment = DB::table('equipment')
            ->where(function ($query) use ($like) {
                $query->where('equipment_name', 'like', $like)
                    ->orWhere('equipment_type', 'like', $like)
                    ->orWhere('equipment_status', 'like', $like);
            })
            ->orderBy('equipment_name')
            ->limit(20)
            ->get([
                'equipment_id',
                'equipment_name',
                'equipment_type',
                'hourly_rental_rate',
                'equipment_status',
            ])
            ->map(fn ($row) => [
                'equipment_id' => (int) $row->equipment_id,
                'equipment_name' => $row->equipment_name,
                'equipment_type' => $row->equipment_type,
                'hourly_rental_rate' => $row->hourly_rental_rate !== null
                    ? (float) $row->hourly_rental_rate
                    : null,
                'equipment_status' => $row->equipment_status,
            ]);

        return response()->json([
            'users' => $users,
            'skills' => $skills,
            'projects' => $projects,
            'phases' => $phases,
            'assignments' => $assignments,
            'materials' => $materials,
            'equipment' => $equipment,
        ]);
    }
}
