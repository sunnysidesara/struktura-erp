<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EquipmentUsage;
use App\Models\LaborHourLog;
use App\Models\Material;
use App\Models\MaterialUsage;
use App\Models\ProjectPhase;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SsController extends Controller
{
    /**
     * Every project id the signed-in supervisor may touch (all for Admin).
     *
     * @return array<int, int>
     */
    private function allowedProjectIds(Request $request): array
    {
        $user = $request->user();
        $query = DB::table('projects');

        if ($user->role?->role_name !== Role::ADMIN) {
            $query->where('site_supervisor_id', $user->user_id);
        }

        return array_map('intval', $query->pluck('project_id')->all());
    }

    /**
     * Project ids in scope for this request: narrowed by the site switcher
     * (`?project_id=`) but never outside the supervisor's own sites.
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

    /**
     * Assignment (with phase/project) that belongs to the given projects.
     */
    private function assignmentFor(array $ids, int $assignmentId): ?object
    {
        if (empty($ids)) {
            return null;
        }

        return DB::table('workforce_assignment as wa')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->whereIn('ph.project_id', $ids)
            ->where('wa.assignment_id', $assignmentId)
            ->select(
                'wa.assignment_id',
                'wa.laborer_id',
                'wa.status',
                'wa.released_at',
                'wa.hourly_rate_ovveride',
                'l.hourly_rate',
                'l.first_name',
                'l.last_name',
                'ph.phase_id',
                'ph.project_id'
            )
            ->first();
    }

    /**
     * A phase-specific assignment rate wins over the laborer's base rate.
     */
    private function rateForAssignment(object $assignment): float
    {
        return $assignment->hourly_rate_ovveride !== null
            ? (float) $assignment->hourly_rate_ovveride
            : (float) $assignment->hourly_rate;
    }

    /**
     * One labor entry per worker, per phase, per day.
     */
    private function laborLogExists(int $laborerId, int $phaseId, string $date, ?int $exceptLogId = null, ?string $shift = null): bool
    {
        return DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->where('wa.laborer_id', $laborerId)
            ->where('wa.phase_id', $phaseId)
            ->whereDate('lhl.log_date', $date)
            ->when($shift !== null, fn ($query) => $query->where('lhl.shift', $shift))
            ->when($exceptLogId !== null, fn ($query) => $query->where('lhl.log_id', '!=', $exceptLogId))
            ->exists();
    }

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
     * Move material stock (negative = consume, positive = refund).
     * Uses the Material model so the change is audited.
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
     * Human readable "12 pcs" style amount for validation messages.
     */
    private function stockLabel(object $material): string
    {
        $amount = rtrim(rtrim(number_format((float) $material->stock_quantity, 2, '.', ''), '0'), '.');

        return $amount.' '.($material->unit_of_measure ?? 'unit(s)');
    }

    /**
     * Current database date (keeps the API and MySQL on the same day).
     */
    private function today(): Carbon
    {
        return Carbon::parse(DB::selectOne('SELECT CURDATE() AS d')->d);
    }

    private function primaryProject(array $ids): ?object
    {
        if (empty($ids)) {
            return null;
        }

        return DB::table('projects as p')
            ->leftJoin('users as sup', 'sup.user_id', '=', 'p.site_supervisor_id')
            ->leftJoin('users as pm', 'pm.user_id', '=', 'p.user_id')
            ->whereIn('p.project_id', $ids)
            ->orderBy('p.project_id')
            ->select(
                'p.project_id',
                'p.project_name',
                'p.client_name',
                'p.location',
                'p.latitude',
                'p.longitude',
                'p.start_date',
                'p.end_date',
                'p.deadline',
                'p.status',
                'p.approved_budget',
                'p.materials_budget',
                'p.equipment_budget',
                'sup.id_number as supervisor_number',
                'sup.first_name as supervisor_first',
                'sup.last_name as supervisor_last',
                'sup.email as supervisor_email',
                'pm.first_name as manager_first',
                'pm.last_name as manager_last',
                'pm.email as manager_email'
            )
            ->first();
    }
    private function currentPhase(array $ids): ?string
    {
        if (empty($ids)) {
            return null;
        }

        $phase = DB::table('project_phases')
            ->whereIn('project_id', $ids)
            ->where('status', 'In Progress')
            ->orderBy('project_id')
            ->orderBy('sequence_no')
            ->select('project_name', 'description')
            ->first();

        return $phase ? ($phase->project_name ?? $phase->description) : null;
    }

    /**
     * Materials / equipment / labor spend recorded against the given projects.
     *
     * @param  array<int, int>  $ids
     * @return array{materials: float, equipment: float, labor: float}
     */
    private function projectSpend(array $ids): array
    {
        if (empty($ids)) {
            return ['materials' => 0.0, 'equipment' => 0.0, 'labor' => 0.0];
        }

        $materials = (float) DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->sum('mu.computed_cost');

        $equipment = (float) DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->sum('eu.computed_cost');

        $labor = (float) DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->sum('lhl.computed_cost');

        return [
            'materials' => round($materials, 2),
            'equipment' => round($equipment, 2),
            'labor' => round($labor, 2),
        ];
    }

    /**
     * Materials / equipment budget provisioned for the given projects.
     *
     * @param  array<int, int>  $ids
     * @return array{materials: float, equipment: float, total: float}
     */
    private function resourceBudget(array $ids): array
    {
        if (empty($ids)) {
            return ['materials' => 0.0, 'equipment' => 0.0, 'total' => 0.0];
        }

        $row = DB::table('projects')
            ->whereIn('project_id', $ids)
            ->selectRaw('SUM(materials_budget) as materials, SUM(equipment_budget) as equipment, SUM(approved_budget) as total')
            ->first();

        return [
            'materials' => round((float) ($row->materials ?? 0), 2),
            'equipment' => round((float) ($row->equipment ?? 0), 2),
            'total' => round((float) ($row->total ?? 0), 2),
        ];
    }

    /**
     * Overall progress per project (average of its phase progress).
     *
     * @param  array<int, int>  $ids
     * @return array<int, int>
     */
    private function projectProgress(array $ids): array
    {
        $buckets = [];

        foreach ($this->phasesPayload($ids) as $phase) {
            $buckets[$phase['project_id']][] = $phase['progress'];
        }

        $progress = [];

        foreach ($buckets as $projectId => $values) {
            $progress[$projectId] = count($values) > 0
                ? (int) round(array_sum($values) / count($values))
                : 0;
        }

        return $progress;
    }

    /**
     * Factual description of the project built from its own record + phases.
     *
     * @param  array<int, array<string, mixed>>  $phases
     */
    private function describeProject(object $project, array $phases): string
    {
        $parts = [];

        if ($project->client_name) {
            $parts[] = 'Client: '.$project->client_name.'.';
        }

        if ($project->location) {
            $parts[] = 'Site located at '.$project->location.'.';
        }

        if ($phases !== []) {
            $names = array_slice(array_column($phases, 'name'), 0, 3);
            $parts[] = 'Scope covers '.count($phases).' phases: '.implode(', ', $names)
                .(count($phases) > count($names) ? ' and more' : '').'.';
        }

        if ($project->start_date && $project->end_date) {
            $parts[] = 'Scheduled from '.$project->start_date.' to '.$project->end_date.'.';
        } elseif ($project->end_date) {
            $parts[] = 'Target completion '.$project->end_date.'.';
        }

        return implode(' ', $parts);
    }

    /**
     * Site banner + financial summary used by every SS screen.
     */
    private function sitePayload(array $ids): ?array
    {
        $project = $this->primaryProject($ids);

        if (! $project) {
            return null;
        }

        $projectId = (int) $project->project_id;
        $phases = $this->phasesPayload([$projectId]);
        $spend = $this->projectSpend([$projectId]);
        $approved = (float) $project->approved_budget;
        $materialsBudget = (float) $project->materials_budget;
        $equipmentBudget = (float) $project->equipment_budget;

        return [
            'project_id' => $projectId,
            'code' => 'PRJ-'.str_pad((string) $project->project_id, 4, '0', STR_PAD_LEFT),
            'project' => $project->project_name,
            'description' => $this->describeProject($project, $phases),
            'location' => $project->location,
            'client' => $project->client_name,
            'supervisor' => trim(($project->supervisor_first ?? '').' '.($project->supervisor_last ?? '')),
            'supervisor_id' => $project->supervisor_number,
            'supervisorEmail' => $project->supervisor_email,
            'manager' => trim(($project->manager_first ?? '').' '.($project->manager_last ?? '')),
            'managerEmail' => $project->manager_email,
            'status' => $project->status,
            'startDate' => $project->start_date,
            'endDate' => $project->end_date ?? $project->deadline,
            'deadline' => $project->deadline,
            'currentPhase' => $this->currentPhase($ids),
            'budgets' => [
                'total' => round($approved, 2),
                'materials' => round($materialsBudget, 2),
                'equipment' => round($equipmentBudget, 2),
                'labor' => round(max(0.0, $approved - $materialsBudget - $equipmentBudget), 2),
            ],
            'spend' => [
                'materials' => $spend['materials'],
                'equipment' => $spend['equipment'],
                'labor' => $spend['labor'],
                'total' => round($spend['materials'] + $spend['equipment'] + $spend['labor'], 2),
            ],
            'coordinates' => [
                'lat' => $project->latitude !== null ? (float) $project->latitude : null,
                'lng' => $project->longitude !== null ? (float) $project->longitude : null,
            ],
        ];
    }
    /**
     * Phases with progress derived from completed site tasks.
     *
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function phasesPayload(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $phases = DB::table('project_phases')
            ->whereIn('project_id', $ids)
            ->orderBy('project_id')
            ->orderBy('sequence_no')
            ->select(
                'phase_id',
                'project_id',
                'project_name',
                'description',
                'sequence_no',
                'planned_start',
                'planned_end',
                'status',
                'completion_requested_at',
                'required_skill_id'
            )
            ->get();

        $counts = DB::table('site_task')
            ->whereIn('project_id', $ids)
            ->select(
                'phase_id',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done")
            )
            ->groupBy('phase_id')
            ->get()
            ->keyBy('phase_id');

        $workers = DB::table('workforce_assignment as wa')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('wa.status', 'Active')
            ->groupBy('wa.phase_id')
            ->select('wa.phase_id', DB::raw('COUNT(DISTINCT wa.laborer_id) as workers'))
            ->pluck('workers', 'phase_id');

        return $phases->map(function ($phase) use ($counts, $workers) {
            $row = $counts->get($phase->phase_id);
            $total = (int) ($row->total ?? 0);
            $done = (int) ($row->done ?? 0);

            if ($phase->status === 'Completed') {
                $progress = 100;
            } elseif ($phase->status === 'Not Started') {
                $progress = 0;
            } else {
                $progress = $total > 0 ? (int) round(($done / $total) * 100) : 0;
            }

            return [
                'phase_id' => (int) $phase->phase_id,
                'id' => 'PH-'.str_pad((string) $phase->phase_id, 2, '0', STR_PAD_LEFT),
                'project_id' => (int) $phase->project_id,
                'name' => $phase->project_name ?? $phase->description ?? 'Phase '.$phase->phase_id,
                'description' => $phase->description,
                'sequence' => (int) ($phase->sequence_no ?? 0),
                'progress' => $progress,
                'status' => $phase->status,
                'completionRequestedAt' => $phase->completion_requested_at,
                'workers' => (int) ($workers[$phase->phase_id] ?? 0),
                'plannedStart' => $phase->planned_start,
                'plannedEnd' => $phase->planned_end,
                'required_skill_id' => $phase->required_skill_id !== null ? (int) $phase->required_skill_id : null,
            ];
        })->values()->all();
    }
    /**
     * @param  array<int, int>  $ids
     * @return array<int, int>
     */
    private function phaseIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return array_map('intval', DB::table('project_phases')->whereIn('project_id', $ids)->pluck('phase_id')->all());
    }

    /**
     * Workers assigned to any phase of the supervisor's projects.
     *
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function workersPayload(array $ids): array
    {
        $phaseIds = $this->phaseIds($ids);

        if (empty($phaseIds)) {
            return [];
        }

        $laborers = DB::table('laborer as l')
            ->join('workforce_assignment as wa', 'wa.laborer_id', '=', 'l.laborer_id')
            ->whereIn('wa.phase_id', $phaseIds)
            ->where('wa.status', 'Active')
            ->select('l.laborer_id', 'l.first_name', 'l.last_name', 'l.employment_status', 'l.contact_number')
            ->distinct()
            ->orderBy('l.laborer_id')
            ->get();

        $skills = DB::table('laborer_skills as ls')
            ->join('skill as s', 's.skill_id', '=', 'ls.skill_id')
            ->whereIn('ls.laborer_id', $laborers->pluck('laborer_id')->all())
            ->orderBy('ls.laborer_skill_id')
            ->select('ls.laborer_id', 's.skill_name')
            ->get()
            ->groupBy('laborer_id');

        return $laborers->map(function ($row) use ($skills) {
            $skillRows = $skills->get($row->laborer_id);

            return [
                'id' => 'LAB-'.str_pad((string) $row->laborer_id, 4, '0', STR_PAD_LEFT),
                'laborer_id' => (int) $row->laborer_id,
                'name' => trim($row->first_name.' '.$row->last_name),
                'skill' => $skillRows && $skillRows->isNotEmpty() ? $skillRows->first()->skill_name : 'Unassigned',
                'skills' => $skillRows ? $skillRows->pluck('skill_name')->values()->all() : [],
                'status' => $row->employment_status,
                'contact' => $row->contact_number,
            ];
        })->values()->all();
    }
    /**
     * Active assignments on the supervisor's phases (used by the labor form).
     *
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function assignmentsPayload(array $ids): array
    {
        $phaseIds = $this->phaseIds($ids);

        if (empty($phaseIds)) {
            return [];
        }

        return DB::table('workforce_assignment as wa')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('wa.phase_id', $phaseIds)
            ->where('wa.status', 'Active')
            ->orderBy('wa.assignment_id')
            ->select(
                'wa.assignment_id',
                'wa.laborer_id',
                'wa.status',
                'wa.role_on_task',
                'l.first_name',
                'l.last_name',
                'ph.phase_id',
                'ph.project_name as phase_name',
                'ph.project_id'
            )
            ->get()
            ->map(fn ($row) => [
                'assignment_id' => (int) $row->assignment_id,
                'laborer_id' => (int) $row->laborer_id,
                'worker' => trim($row->first_name.' '.$row->last_name),
                'phase_id' => (int) $row->phase_id,
                'phase' => $row->phase_name,
                'role_on_task' => $row->role_on_task,
                'status' => $row->status,
            ])->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function materialsPayload(): array
    {
        return DB::table('materials')
            ->orderBy('material_name')
            ->get()
            ->map(fn ($row) => [
                'material_id' => (int) $row->material_id,
                'name' => $row->material_name,
                'unit' => $row->unit_of_measure,
                'stock' => (int) $row->stock_quantity,
            ])->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function equipmentPayload(): array
    {
        return DB::table('equipment')
            ->orderBy('equipment_name')
            ->get()
            ->map(fn ($row) => [
                'equipment_id' => (int) $row->equipment_id,
                'name' => $row->equipment_name,
                'type' => $row->equipment_type,
                'status' => $row->equipment_status,
            ])->values()->all();
    }
    /**
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function laborLogsPayload(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->whereIn('ph.project_id', $ids)
            ->orderByDesc('lhl.log_date')
            ->orderByDesc('lhl.log_id')
            ->limit(60)
            ->select(
                'lhl.log_id',
                'lhl.assignment_id',
                'lhl.log_date',
                'lhl.shift',
                'lhl.time_in',
                'lhl.time_out',
                'lhl.regular_hours',
                'lhl.overtime_hours',
                'lhl.computed_cost',
                'l.first_name',
                'l.last_name',
                'ph.phase_id',
                'ph.project_name as phase_name',
                'p.project_id',
                'p.project_name'
            )
            ->get()
            ->map(fn ($row) => [
                'id' => 'LL-'.str_pad((string) $row->log_id, 4, '0', STR_PAD_LEFT),
                'log_id' => (int) $row->log_id,
                'assignment_id' => (int) $row->assignment_id,
                'date' => $row->log_date,
                'shift' => $row->shift ?? 'Morning',
                'time_in' => $row->time_in ? substr((string) $row->time_in, 0, 5) : null,
                'time_out' => $row->time_out ? substr((string) $row->time_out, 0, 5) : null,
                'worker' => trim($row->first_name.' '.$row->last_name),
                'regular' => (float) $row->regular_hours,
                'overtime' => (float) $row->overtime_hours,
                'total' => (float) $row->regular_hours + (float) $row->overtime_hours,
                'expense' => round((float) ($row->computed_cost ?? 0), 2),
                'phase_id' => (int) $row->phase_id,
                'phase' => $row->phase_name,
                'project_id' => (int) $row->project_id,
                'project' => $row->project_name,
                'status' => 'Submitted',
            ])->values()->all();
    }

    /**
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function materialLogsPayload(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return DB::table('material_usage as mu')
            ->join('materials as m', 'm.material_id', '=', 'mu.material_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->whereIn('ph.project_id', $ids)
            ->orderByDesc('mu.usage_date')
            ->orderByDesc('mu.material_usage_id')
            ->limit(60)
            ->select(
                'mu.material_usage_id',
                'mu.material_id',
                'mu.usage_date',
                'mu.quantity_used',
                'mu.computed_cost',
                'm.material_name',
                'm.unit_of_measure',
                'ph.phase_id',
                'ph.project_name as phase_name',
                'p.project_id',
                'p.project_name'
            )
            ->get()
            ->map(fn ($row) => [
                'id' => 'ML-'.str_pad((string) $row->material_usage_id, 4, '0', STR_PAD_LEFT),
                'usage_id' => (int) $row->material_usage_id,
                'material_id' => (int) $row->material_id,
                'date' => $row->usage_date,
                'material' => $row->material_name,
                'quantity' => (float) $row->quantity_used,
                'unit' => $row->unit_of_measure,
                'expense' => round((float) ($row->computed_cost ?? 0), 2),
                'phase_id' => (int) $row->phase_id,
                'phase' => $row->phase_name,
                'project_id' => (int) $row->project_id,
                'project' => $row->project_name,
                'status' => 'Submitted',
            ])->values()->all();
    }

    /**
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function equipmentLogsPayload(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return DB::table('equipment_usage as eu')
            ->join('equipment as e', 'e.equipment_id', '=', 'eu.equipment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->join('projects as p', 'p.project_id', '=', 'ph.project_id')
            ->whereIn('ph.project_id', $ids)
            ->orderByDesc('eu.usage_date')
            ->orderByDesc('eu.equipment_usage_id')
            ->limit(60)
            ->select(
                'eu.equipment_usage_id',
                'eu.equipment_id',
                'eu.usage_date',
                'eu.hours_used',
                'eu.computed_cost',
                'e.equipment_name',
                'ph.phase_id',
                'ph.project_name as phase_name',
                'p.project_id',
                'p.project_name'
            )
            ->get()
            ->map(fn ($row) => [
                'id' => 'EL-'.str_pad((string) $row->equipment_usage_id, 4, '0', STR_PAD_LEFT),
                'usage_id' => (int) $row->equipment_usage_id,
                'equipment_id' => (int) $row->equipment_id,
                'date' => $row->usage_date,
                'equipment' => $row->equipment_name,
                'hours' => (float) $row->hours_used,
                'expense' => round((float) ($row->computed_cost ?? 0), 2),
                'phase_id' => (int) $row->phase_id,
                'phase' => $row->phase_name,
                'project_id' => (int) $row->project_id,
                'project' => $row->project_name,
                'status' => 'Submitted',
            ])->values()->all();
    }
    /**
     * Turn per-day rows (d / v) into a padded 7-day series.
     */
    private function fillSeries($rows): array
    {
        $today = $this->today();
        $map = collect($rows)->keyBy('d');
        $series = [];

        for ($i = 6; $i >= 0; $i--) {
            $date = $today->copy()->subDays($i);
            $key = $date->toDateString();
            $series[] = [
                'label' => $date->format('M j'),
                'date' => $key,
                'value' => (float) ($map[$key]->v ?? 0),
            ];
        }

        return $series;
    }

    private function laborSeries(array $ids): array
    {
        if (empty($ids)) {
            return $this->fillSeries(collect());
        }

        $rows = DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('lhl.log_date', '>=', $this->today()->subDays(6)->toDateString())
            ->groupBy('lhl.log_date')
            ->select('lhl.log_date as d', DB::raw('SUM(lhl.regular_hours + lhl.overtime_hours) as v'))
            ->get();

        return $this->fillSeries($rows);
    }

    private function materialSeries(array $ids): array
    {
        if (empty($ids)) {
            return $this->fillSeries(collect());
        }

        $rows = DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('mu.usage_date', '>=', $this->today()->subDays(6)->toDateString())
            ->groupBy('mu.usage_date')
            ->select('mu.usage_date as d', DB::raw('COUNT(*) as v'))
            ->get();

        return $this->fillSeries($rows);
    }

    private function equipmentSeries(array $ids): array
    {
        if (empty($ids)) {
            return $this->fillSeries(collect());
        }

        $rows = DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('eu.usage_date', '>=', $this->today()->subDays(6)->toDateString())
            ->groupBy('eu.usage_date')
            ->select('eu.usage_date as d', DB::raw('SUM(eu.hours_used) as v'))
            ->get();

        return $this->fillSeries($rows);
    }

    /**
     * Daily roll-up of labor / material / equipment activity.
     *
     * @param  array<int, int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function submissionsPayload(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $start = $this->today()->subDays(6)->toDateString();

        $labor = DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('lhl.log_date', '>=', $start)
            ->groupBy('lhl.log_date')
            ->select('lhl.log_date as d', DB::raw('SUM(lhl.regular_hours + lhl.overtime_hours) as v'))
            ->get()
            ->keyBy('d');

        $materials = DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('mu.usage_date', '>=', $start)
            ->groupBy('mu.usage_date')
            ->select('mu.usage_date as d', DB::raw('COUNT(*) as v'))
            ->get()
            ->keyBy('d');

        $equipment = DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('eu.usage_date', '>=', $start)
            ->groupBy('eu.usage_date')
            ->select('eu.usage_date as d', DB::raw('SUM(eu.hours_used) as v'))
            ->get()
            ->keyBy('d');

        return collect($labor->keys())
            ->merge($materials->keys())
            ->merge($equipment->keys())
            ->unique()
            ->sortDesc()
            ->values()
            ->map(fn ($day) => [
                'date' => $day,
                'labor' => (float) ($labor[$day]->v ?? 0),
                'materials' => (int) ($materials[$day]->v ?? 0),
                'equipment' => (float) ($equipment[$day]->v ?? 0),
                'status' => 'Submitted',
            ])
            ->all();
    }
    /**
     * Sites the supervisor can switch between (all assigned projects).
     *
     * @return array<int, array<string, mixed>>
     */
    private function sitesPayload(Request $request): array
    {
        $ids = $this->allowedProjectIds($request);

        if (empty($ids)) {
            return [];
        }

        $progress = $this->projectProgress($ids);

        return DB::table('projects')
            ->whereIn('project_id', $ids)
            ->orderBy('project_id')
            ->get(['project_id', 'project_name', 'location', 'status'])
            ->map(fn ($row) => [
                'project_id' => (int) $row->project_id,
                'code' => 'PRJ-'.str_pad((string) $row->project_id, 4, '0', STR_PAD_LEFT),
                'project' => $row->project_name,
                'location' => $row->location,
                'status' => $row->status,
                'progress' => $progress[(int) $row->project_id] ?? 0,
            ])->values()->all();
    }

    /**
     * The site currently selected through `?project_id=` (if valid).
     */
    private function selectedProjectId(Request $request): ?int
    {
        $selected = (int) $request->query('project_id', 0);

        return $selected > 0 && in_array($selected, $this->allowedProjectIds($request), true)
            ? $selected
            : null;
    }

    public function sites(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->sitesPayload($request),
            'selected_project_id' => $this->selectedProjectId($request),
        ]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $phases = $this->phasesPayload($ids);
        $today = $this->today()->toDateString();

        $laborToday = empty($ids) ? 0.0 : (float) DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('lhl.log_date', $today)
            ->sum(DB::raw('lhl.regular_hours + lhl.overtime_hours'));

        $materialToday = empty($ids) ? 0 : DB::table('material_usage as mu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'mu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('mu.usage_date', $today)
            ->count();

        $equipmentToday = empty($ids) ? 0.0 : (float) DB::table('equipment_usage as eu')
            ->join('project_phases as ph', 'ph.phase_id', '=', 'eu.phase_id')
            ->whereIn('ph.project_id', $ids)
            ->where('eu.usage_date', $today)
            ->sum('eu.hours_used');

        return response()->json([
            'server_date' => $today,
            'sites' => $this->sitesPayload($request),
            'selected_project_id' => $this->selectedProjectId($request),
            'site' => $this->sitePayload($ids),
            'metrics' => [
                'labor_hours_today' => round($laborToday, 2),
                'material_entries_today' => $materialToday,
                'equipment_hours_today' => round($equipmentToday, 2),
                'active_phases' => count(array_filter($phases, fn ($phase) => $phase['status'] === 'In Progress')),
                'total_phases' => count($phases),
            ],
            'labor_series' => $this->laborSeries($ids),
            'phases' => $phases,
            'submissions' => $this->submissionsPayload($ids),
        ]);
    }

    public function site(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $phases = $this->phasesPayload($ids);
        $project = $this->primaryProject($ids);
        $workers = $this->workersPayload($ids);

        $phaseCount = count($phases);
        $completed = count(array_filter($phases, fn ($phase) => $phase['status'] === 'Completed'));
        $overall = $phaseCount > 0 ? (int) round(array_sum(array_column($phases, 'progress')) / $phaseCount) : 0;

        $daysRemaining = 0;
        if ($project && $project->end_date) {
            $daysRemaining = max(0, (int) round($this->today()->diffInDays(Carbon::parse($project->end_date), false)));
        }

        return response()->json([
            'server_date' => $this->today()->toDateString(),
            'site' => $this->sitePayload($ids),
            'metrics' => [
                'overall_progress' => $overall,
                'completed_phases' => $completed,
                'total_phases' => $phaseCount,
                'days_remaining' => $daysRemaining,
                'active_workers' => count(array_filter($workers, fn ($worker) => $worker['status'] === 'Active')),
                'total_workers' => count($workers),
            ],
            'phases' => $phases,
        ]);
    }

    public function siteInfo(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);

        return response()->json([
            'server_date' => $this->today()->toDateString(),
            'site' => $this->sitePayload($ids),
            'phases' => $this->phasesPayload($ids),
        ]);
    }
    public function schedule(Request $request): JsonResponse
    {
        $scope = (string) $request->query('scope', 'today');

        if (! in_array($scope, ['today', 'week', 'all'], true)) {
            $scope = 'today';
        }

        $ids = $this->projectIds($request);
        $today = $this->today();

        $query = DB::table('site_task as t')
            ->leftJoin('project_phases as ph', 'ph.phase_id', '=', 't.phase_id')
            ->leftJoin('laborer as l', 'l.laborer_id', '=', 't.assigned_laborer_id')
            ->leftJoin('projects as p', 'p.project_id', '=', 't.project_id')
            ->whereIn('t.project_id', $ids)
            ->select(
                't.task_id',
                't.project_id',
                't.phase_id',
                't.title',
                't.task_date',
                't.start_time',
                't.status',
                'p.project_name',
                'ph.project_name as phase_name',
                'l.first_name',
                'l.last_name'
            );

        if ($scope === 'today') {
            $query->whereDate('t.task_date', $today->toDateString());
        } elseif ($scope === 'week') {
            $query->whereBetween('t.task_date', [
                $today->copy()->startOfWeek()->toDateString(),
                $today->copy()->endOfWeek()->toDateString(),
            ]);
        }

        $tasks = $query
            ->orderBy('t.task_date')
            ->orderBy('t.start_time')
            ->orderBy('t.task_id')
            ->get()
            ->map(fn ($row) => [
                'id' => 'TSK-'.$row->task_id,
                'task_id' => (int) $row->task_id,
                'date' => $row->task_date,
                'time' => $row->start_time ? substr((string) $row->start_time, 0, 5) : '',
                'title' => $row->title,
                'phase' => $row->phase_name ?? '—',
                'assignee' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')) ?: 'Unassigned',
                'status' => $row->status,
                'project' => $row->project_name,
                'project_id' => (int) $row->project_id,
            ])->values()->all();

        return response()->json([
            'scope' => $scope,
            'server_date' => $today->toDateString(),
            'data' => $tasks,
            'counts' => [
                'total' => count($tasks),
                'done' => count(array_filter($tasks, fn ($task) => $task['status'] === 'Done')),
                'in_progress' => count(array_filter($tasks, fn ($task) => $task['status'] === 'In Progress')),
                'pending' => count(array_filter($tasks, fn ($task) => $task['status'] === 'Pending')),
            ],
        ]);
    }

    public function logHours(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $today = $this->today()->toDateString();
        $logs = $this->laborLogsPayload($ids);
        $workers = $this->workersPayload($ids);
        $todayLogs = array_filter($logs, fn ($log) => $log['date'] === $today);

        return response()->json([
            'server_date' => $today,
            'assignments' => $this->assignmentsPayload($ids),
            'workers' => $workers,
            'logs' => $logs,
            'series' => $this->laborSeries($ids),
            'metrics' => [
                'hours_today' => round(array_sum(array_column($todayLogs, 'total')), 2),
                'logs_today' => count($todayLogs),
                'crew' => count(array_filter($workers, fn ($worker) => $worker['status'] === 'Active')),
                'total_logs' => count($logs),
            ],
        ]);
    }
    public function materials(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $today = $this->today()->toDateString();
        $logs = $this->materialLogsPayload($ids);
        $todayLogs = array_filter($logs, fn ($log) => $log['date'] === $today);
        $budget = $this->resourceBudget($ids);
        $spend = $this->projectSpend($ids);

        return response()->json([
            'server_date' => $today,
            'materials' => $this->materialsPayload(),
            'phases' => $this->phasesPayload($ids),
            'logs' => $logs,
            'series' => $this->materialSeries($ids),
            'metrics' => [
                'entries_today' => count($todayLogs),
                'distinct_today' => count(array_unique(array_column($todayLogs, 'material'))),
                'total_logs' => count($logs),
                'materials_allocation' => $budget['materials'],
                'materials_spent' => $spend['materials'],
                'materials_remaining' => round($budget['materials'] - $spend['materials'], 2),
            ],
        ]);
    }

    public function equipment(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $today = $this->today()->toDateString();
        $logs = $this->equipmentLogsPayload($ids);
        $todayLogs = array_filter($logs, fn ($log) => $log['date'] === $today);
        $budget = $this->resourceBudget($ids);
        $spend = $this->projectSpend($ids);

        return response()->json([
            'server_date' => $today,
            'equipment' => $this->equipmentPayload(),
            'phases' => $this->phasesPayload($ids),
            'logs' => $logs,
            'series' => $this->equipmentSeries($ids),
            'metrics' => [
                'hours_today' => round(array_sum(array_column($todayLogs, 'hours')), 2),
                'logs_today' => count($todayLogs),
                'machines_today' => count(array_unique(array_column($todayLogs, 'equipment'))),
                'total_logs' => count($logs),
                'equipment_allocation' => $budget['equipment'],
                'equipment_spent' => $spend['equipment'],
                'equipment_remaining' => round($budget['equipment'] - $spend['equipment'], 2),
            ],
        ]);
    }

    public function workers(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $workers = $this->workersPayload($ids);

        return response()->json([
            'data' => $workers,
            'metrics' => [
                'total' => count($workers),
                'active' => count(array_filter($workers, fn ($worker) => $worker['status'] === 'Active')),
                'inactive' => count(array_filter($workers, fn ($worker) => $worker['status'] !== 'Active')),
                'skills' => count(array_unique(array_column($workers, 'skill'))),
            ],
        ]);
    }

    public function phases(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request);
        $phases = $this->phasesPayload($ids);
        $count = count($phases);

        return response()->json([
            'data' => $phases,
            'metrics' => [
                'total' => $count,
                'completed' => count(array_filter($phases, fn ($phase) => $phase['status'] === 'Completed')),
                'in_progress' => count(array_filter($phases, fn ($phase) => $phase['status'] === 'In Progress')),
                'average_progress' => $count > 0 ? (int) round(array_sum(array_column($phases, 'progress')) / $count) : 0,
            ],
        ]);
    }
    /**
     * Hours between two "HH:MM" strings, or null when either is missing.
     */
    private function hoursFromTimes(?string $timeIn, ?string $timeOut): ?float
    {
        if ($timeIn === null || $timeOut === null || $timeIn === '' || $timeOut === '') {
            return null;
        }

        $minutes = Carbon::createFromFormat('H:i', $timeIn)->diffInMinutes(Carbon::createFromFormat('H:i', $timeOut), false);

        if ($minutes <= 0) {
            throw ValidationException::withMessages([
                'time_out' => ['Time out must be later than time in.'],
            ]);
        }

        return round($minutes / 60, 2);
    }

    /**
     * Supervisor asks the Project Manager to sign a phase off.
     */
    public function requestCompletion(Request $request, int $id): JsonResponse
    {
        $ids = $this->projectIds($request);
        $phase = $this->phaseFor($ids, $id);

        if (! $phase) {
            return response()->json(['message' => 'This phase is not part of your assigned sites.'], 404);
        }

        if ($phase->status === 'Completed') {
            return response()->json(['message' => 'This phase is already completed.'], 422);
        }

        if ($phase->status !== 'In Progress') {
            return response()->json([
                'message' => 'The Project Manager must start this phase before completion can be requested.',
            ], 422);
        }

        $totalTasks = DB::table('site_task')->where('phase_id', $id)->count();
        $openTasks = DB::table('site_task')
            ->where('phase_id', $id)
            ->where('status', '!=', 'Done')
            ->count();

        if ($totalTasks === 0) {
            return response()->json([
                'message' => 'Add at least one task before requesting phase completion.',
            ], 422);
        }

        if ($openTasks > 0) {
            return response()->json([
                'message' => 'Complete all phase tasks before requesting completion.',
            ], 422);
        }

        $model = ProjectPhase::query()->find($id);

        if (! $model) {
            return response()->json(['message' => 'Phase not found.'], 404);
        }

        $model->update([
            'completion_requested_at' => Carbon::now(),
            'completion_requested_by' => $request->user()->user_id,
            'updated_by' => $request->user()->user_id,
        ]);

        $name = $phase->project_name ?? $phase->description ?? 'Phase '.$id;

        return response()->json([
            'message' => 'Completion requested for "'.$name.'". Your Project Manager has been notified.',
            'data' => [
                'phase_id' => $id,
                'completion_requested_at' => $model->completion_requested_at?->toDateTimeString(),
            ],
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        $ids = $this->projectIds($request);

        $empty = [
            'query' => $query,
            'workers' => [],
            'phases' => [],
            'tasks' => [],
            'materials' => [],
            'equipment' => [],
        ];

        if ($query === '' || empty($ids)) {
            return response()->json($empty);
        }

        $needle = mb_strtolower($query);
        $match = function (array $values) use ($needle): bool {
            foreach ($values as $value) {
                if ($value !== null && str_contains(mb_strtolower((string) $value), $needle)) {
                    return true;
                }
            }

            return false;
        };

        $workers = array_values(array_filter(
            $this->workersPayload($ids),
            fn ($row) => $match([$row['id'], $row['name'], $row['skill'], $row['status'], $row['contact']])
        ));

        $phases = array_values(array_filter(
            $this->phasesPayload($ids),
            fn ($row) => $match([$row['id'], $row['name'], $row['status']])
        ));

        $materials = array_values(array_filter(
            $this->materialLogsPayload($ids),
            fn ($row) => $match([$row['date'], $row['material'], $row['unit'], $row['phase'], $row['status']])
        ));

        $equipment = array_values(array_filter(
            $this->equipmentLogsPayload($ids),
            fn ($row) => $match([$row['date'], $row['equipment'], $row['phase'], $row['status']])
        ));

        $tasks = DB::table('site_task as t')
            ->leftJoin('project_phases as ph', 'ph.phase_id', '=', 't.phase_id')
            ->leftJoin('laborer as l', 'l.laborer_id', '=', 't.assigned_laborer_id')
            ->whereIn('t.project_id', $ids)
            ->orderByDesc('t.task_date')
            ->orderByDesc('t.task_id')
            ->limit(100)
            ->select(
                't.task_id',
                't.task_date',
                't.start_time',
                't.title',
                't.status',
                'ph.project_name as phase_name',
                'l.first_name',
                'l.last_name'
            )
            ->get()
            ->map(fn ($row) => [
                'id' => 'TSK-'.$row->task_id,
                'task_id' => (int) $row->task_id,
                'date' => $row->task_date,
                'time' => $row->start_time ? substr((string) $row->start_time, 0, 5) : '',
                'title' => $row->title,
                'phase' => $row->phase_name ?? '—',
                'assignee' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')) ?: 'Unassigned',
                'status' => $row->status,
            ])
            ->filter(fn ($row) => $match([$row['date'], $row['title'], $row['phase'], $row['assignee'], $row['status']]))
            ->values()
            ->all();

        return response()->json([
            'query' => $query,
            'workers' => $workers,
            'phases' => $phases,
            'tasks' => $tasks,
            'materials' => $materials,
            'equipment' => $equipment,
        ]);
    }
    public function storeLaborLog(Request $request): JsonResponse
    {
        $data = $request->validate([
            'assignment_id' => ['required', 'integer'],
            'log_date' => ['required', 'date', 'before_or_equal:today'],
            'shift' => ['nullable', 'in:Morning,Afternoon'],
            'time_in' => ['nullable', 'date_format:H:i'],
            'time_out' => ['nullable', 'date_format:H:i'],
            'regular_hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'overtime_hours' => ['nullable', 'numeric', 'min:0', 'max:12'],
        ]);

        $shift = $data['shift'] ?? 'Morning';
        $timeIn = $data['time_in'] ?? null;
        $timeOut = $data['time_out'] ?? null;

        $ids = $this->projectIds($request);
        $assignment = $this->assignmentFor($ids, (int) $data['assignment_id']);

        if (! $assignment) {
            return response()->json(['message' => 'That assignment does not belong to your site.'], 403);
        }

        if ($assignment->status !== 'Active' || $assignment->released_at !== null) {
            return response()->json([
                'message' => 'This laborer has been released from the phase, so hours cannot be logged against it.',
            ], 422);
        }

        $regular = $this->hoursFromTimes($timeIn, $timeOut) ?? round((float) ($data['regular_hours'] ?? 0), 2);
        $overtime = round((float) ($data['overtime_hours'] ?? 0), 2);

        if ($regular + $overtime <= 0) {
            return response()->json(['message' => 'Enter the shift times or at least one hour.'], 422);
        }

        if ($regular + $overtime > 24) {
            return response()->json([
                'message' => 'A laborer cannot log more than 24 hours in one day.',
            ], 422);
        }

        if ($this->laborLogExists((int) $assignment->laborer_id, (int) $assignment->phase_id, (string) $data['log_date'], null, $shift)) {
            return response()->json([
                'message' => 'This laborer already has hours logged for this phase on '.$data['log_date'].'. Edit that entry instead.',
            ], 422);
        }

        $rate = $this->rateForAssignment($assignment);

        $logId = DB::transaction(function () use ($data, $shift, $timeIn, $timeOut, $regular, $overtime, $rate, $assignment, $request) {
            $log = LaborHourLog::create([
                'assignment_id' => $assignment->assignment_id,
                'log_date' => $data['log_date'],
                'shift' => $shift,
                'time_in' => $timeIn,
                'time_out' => $timeOut,
                'regular_hours' => $regular,
                'overtime_hours' => $overtime,
                'hourly_rate_at_use' => $rate,
                'created_by' => $request->user()->user_id,
                'created_at' => now(),
            ]);

            return $log->log_id;
        });

        return response()->json([
            'message' => 'Labor hours saved.',
            'data' => [
                'log_id' => (int) $logId,
                'worker' => trim($assignment->first_name.' '.$assignment->last_name),
                'regular_hours' => $regular,
                'overtime_hours' => $overtime,
                'total_hours' => round($regular + $overtime, 2),
            ],
        ], 201);
    }

    /**
     * Correct a labor entry (typos, wrong date, wrong hours).
     */
    public function updateLaborLog(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'assignment_id' => ['nullable', 'integer'],
            'log_date' => ['required', 'date', 'before_or_equal:today'],
            'shift' => ['nullable', 'in:Morning,Afternoon'],
            'time_in' => ['nullable', 'date_format:H:i'],
            'time_out' => ['nullable', 'date_format:H:i'],
            'regular_hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'overtime_hours' => ['nullable', 'numeric', 'min:0', 'max:12'],
        ]);

        $log = LaborHourLog::find($id);

        if (! $log) {
            return response()->json(['message' => 'Labor log not found.'], 404);
        }

        $shift = $data['shift'] ?? $log->shift ?? 'Morning';
        $timeIn = $data['time_in'] ?? ($log->time_in ? substr((string) $log->time_in, 0, 5) : null);
        $timeOut = $data['time_out'] ?? ($log->time_out ? substr((string) $log->time_out, 0, 5) : null);

        $ids = $this->projectIds($request);
        $original = $this->assignmentFor($ids, (int) $log->assignment_id);

        if (! $original) {
            return response()->json(['message' => 'You can only correct logs from your own site.'], 403);
        }

        $assignmentId = (int) ($data['assignment_id'] ?? $log->assignment_id);
        $assignment = $assignmentId === (int) $log->assignment_id
            ? $original
            : $this->assignmentFor($ids, $assignmentId);

        if (! $assignment) {
            return response()->json(['message' => 'That assignment does not belong to your site.'], 403);
        }

        if ($assignment->status !== 'Active' || $assignment->released_at !== null) {
            return response()->json([
                'message' => 'This laborer has been released from the phase, so this log cannot be moved to it.',
            ], 422);
        }

        $regular = $this->hoursFromTimes($timeIn, $timeOut)
            ?? (isset($data['regular_hours'])
                ? round((float) $data['regular_hours'], 2)
                : round((float) $log->regular_hours, 2));
        $overtime = round((float) ($data['overtime_hours'] ?? 0), 2);

        if ($regular + $overtime <= 0) {
            return response()->json(['message' => 'Enter at least one hour.'], 422);
        }

        if ($regular + $overtime > 24) {
            return response()->json([
                'message' => 'A laborer cannot log more than 24 hours in one day.',
            ], 422);
        }

        if ($this->laborLogExists(
            (int) $assignment->laborer_id,
            (int) $assignment->phase_id,
            (string) $data['log_date'],
            (int) $log->log_id,
            $shift
        )) {
            return response()->json([
                'message' => 'Another entry already exists for this laborer on this phase for that date.',
            ], 422);
        }

        $rate = $this->rateForAssignment($assignment);

        DB::transaction(function () use ($log, $assignment, $data, $shift, $timeIn, $timeOut, $regular, $overtime, $rate) {
            $log->update([
                'assignment_id' => $assignment->assignment_id,
                'log_date' => $data['log_date'],
                'shift' => $shift,
                'time_in' => $timeIn,
                'time_out' => $timeOut,
                'regular_hours' => $regular,
                'overtime_hours' => $overtime,
                'hourly_rate_at_use' => $rate,
            ]);
        });

        return response()->json([
            'message' => 'Labor log updated.',
            'data' => [
                'log_id' => (int) $log->log_id,
                'worker' => trim($assignment->first_name.' '.$assignment->last_name),
                'regular_hours' => $regular,
                'overtime_hours' => $overtime,
                'total_hours' => round($regular + $overtime, 2),
            ],
        ]);
    }

    /**
     * Void a labor entry and refund the project budget.
     */
    public function destroyLaborLog(Request $request, int $id): JsonResponse
    {
        $log = LaborHourLog::find($id);

        if (! $log) {
            return response()->json(['message' => 'Labor log not found.'], 404);
        }

        $assignment = $this->assignmentFor($this->projectIds($request), (int) $log->assignment_id);

        if (! $assignment) {
            return response()->json(['message' => 'You can only void logs from your own site.'], 403);
        }

        DB::transaction(function () use ($log) {
            $log->delete();
        });

        return response()->json(['message' => 'Labor log voided and the budget refunded.']);
    }
    public function storeMaterialUsage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'material_id' => ['required', 'integer', 'exists:materials,material_id'],
            'phase_id' => ['required', 'integer'],
            'usage_date' => ['required', 'date', 'before_or_equal:today'],
            'quantity_used' => ['required', 'numeric', 'min:0.01', 'max:100000'],
        ]);

        $ids = $this->projectIds($request);
        $phase = $this->phaseFor($ids, (int) $data['phase_id']);

        if (! $phase) {
            return response()->json(['message' => 'That phase does not belong to your site.'], 403);
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
            $usage = MaterialUsage::create([
                'material_id' => $material->material_id,
                'phase_id' => $phase->phase_id,
                'usage_date' => $data['usage_date'],
                'quantity_used' => $quantity,
                'unit_cost_at_use' => (float) $material->unit_cost,
                'created_by' => $request->user()->user_id,
                'updated_by' => $request->user()->user_id,
            ]);

            $this->adjustMaterialStock((int) $material->material_id, -$quantity);

            return $usage->material_usage_id;
        });

        return response()->json([
            'message' => 'Material usage saved.',
            'data' => [
                'material_usage_id' => (int) $usageId,
                'material' => $material->material_name,
                'quantity_used' => $quantity,
                'unit' => $material->unit_of_measure,
            ],
        ], 201);
    }
    /**
     * Correct a material entry (quantity, date, phase or material).
     */
    public function updateMaterialUsage(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'material_id' => ['nullable', 'integer', 'exists:materials,material_id'],
            'phase_id' => ['nullable', 'integer'],
            'usage_date' => ['required', 'date', 'before_or_equal:today'],
            'quantity_used' => ['required', 'numeric', 'min:0.01', 'max:100000'],
        ]);

        $usage = MaterialUsage::find($id);

        if (! $usage) {
            return response()->json(['message' => 'Material log not found.'], 404);
        }

        $ids = $this->projectIds($request);
        $originalPhase = $this->phaseFor($ids, (int) $usage->phase_id);

        if (! $originalPhase) {
            return response()->json(['message' => 'You can only correct logs from your own site.'], 403);
        }

        $phase = isset($data['phase_id']) && $data['phase_id'] !== null
            ? $this->phaseFor($ids, (int) $data['phase_id'])
            : $originalPhase;

        if (! $phase) {
            return response()->json(['message' => 'That phase does not belong to your site.'], 403);
        }

        $materialId = (int) ($data['material_id'] ?? $usage->material_id);
        $material = Material::find($materialId);

        if (! $material) {
            return response()->json(['message' => 'Unknown material.'], 422);
        }

        $quantity = round((float) $data['quantity_used'], 2);
        $held = $materialId === (int) $usage->material_id ? (float) $usage->quantity_used : 0.0;

        if ($quantity > (float) $material->stock_quantity + $held) {
            return response()->json([
                'message' => 'Only '.$this->stockLabel($material).' of '.$material->material_name.' are available.',
            ], 422);
        }

        DB::transaction(function () use ($usage, $phase, $materialId, $material, $data, $quantity) {
            // Put the previous entry back, then apply the corrected one.
            $this->adjustMaterialStock((int) $usage->material_id, (float) $usage->quantity_used);

            $usage->update([
                'material_id' => $materialId,
                'phase_id' => $phase->phase_id,
                'usage_date' => $data['usage_date'],
                'quantity_used' => $quantity,
                'unit_cost_at_use' => (float) $material->unit_cost,
            ]);

            $this->adjustMaterialStock($materialId, -$quantity);
        });

        return response()->json([
            'message' => 'Material log updated.',
            'data' => [
                'material_usage_id' => (int) $usage->material_usage_id,
                'material' => $material->material_name,
                'quantity_used' => $quantity,
                'unit' => $material->unit_of_measure,
            ],
        ]);
    }

    /**
     * Void a material entry: refund stock and the project budget.
     */
    public function destroyMaterialUsage(Request $request, int $id): JsonResponse
    {
        $usage = MaterialUsage::find($id);

        if (! $usage) {
            return response()->json(['message' => 'Material log not found.'], 404);
        }

        $phase = $this->phaseFor($this->projectIds($request), (int) $usage->phase_id);

        if (! $phase) {
            return response()->json(['message' => 'You can only void logs from your own site.'], 403);
        }

        DB::transaction(function () use ($usage) {
            $this->adjustMaterialStock((int) $usage->material_id, (float) $usage->quantity_used);

            $usage->delete();
        });

        return response()->json([
            'message' => 'Material log voided, stock restored and the budget refunded.',
        ]);
    }

    public function storeEquipmentUsage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'equipment_id' => ['required', 'integer', 'exists:equipment,equipment_id'],
            'phase_id' => ['required', 'integer'],
            'usage_date' => ['required', 'date', 'before_or_equal:today'],
            'hours_used' => ['required', 'numeric', 'min:0.01', 'max:24'],
        ]);

        $ids = $this->projectIds($request);
        $phase = $this->phaseFor($ids, (int) $data['phase_id']);

        if (! $phase) {
            return response()->json(['message' => 'That phase does not belong to your site.'], 403);
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
            $usage = EquipmentUsage::create([
                'equipment_id' => $equipment->equipment_id,
                'phase_id' => $phase->phase_id,
                'usage_date' => $data['usage_date'],
                'hours_used' => $hours,
                'hourly_rate_at_use' => (float) $equipment->hourly_rental_rate,
                'created_by' => $request->user()->user_id,
                'updated_by' => $request->user()->user_id,
            ]);

            return $usage->equipment_usage_id;
        });

        return response()->json([
            'message' => 'Equipment usage saved.',
            'data' => [
                'equipment_usage_id' => (int) $usageId,
                'equipment' => $equipment->equipment_name,
                'hours_used' => $hours,
            ],
        ], 201);
    }

    /**
     * Correct an equipment entry (hours, date, phase or machine).
     */
    public function updateEquipmentUsage(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'equipment_id' => ['nullable', 'integer', 'exists:equipment,equipment_id'],
            'phase_id' => ['nullable', 'integer'],
            'usage_date' => ['required', 'date', 'before_or_equal:today'],
            'hours_used' => ['required', 'numeric', 'min:0.01', 'max:24'],
        ]);

        $usage = EquipmentUsage::find($id);

        if (! $usage) {
            return response()->json(['message' => 'Equipment log not found.'], 404);
        }

        $ids = $this->projectIds($request);
        $originalPhase = $this->phaseFor($ids, (int) $usage->phase_id);

        if (! $originalPhase) {
            return response()->json(['message' => 'You can only correct logs from your own site.'], 403);
        }

        $phase = isset($data['phase_id']) && $data['phase_id'] !== null
            ? $this->phaseFor($ids, (int) $data['phase_id'])
            : $originalPhase;

        if (! $phase) {
            return response()->json(['message' => 'That phase does not belong to your site.'], 403);
        }

        $equipmentId = (int) ($data['equipment_id'] ?? $usage->equipment_id);
        $equipment = DB::table('equipment')->where('equipment_id', $equipmentId)->first();

        if (! $equipment) {
            return response()->json(['message' => 'Unknown equipment.'], 422);
        }

        if ($equipment->equipment_status === 'Under Maintenance') {
            return response()->json([
                'message' => 'This equipment is under maintenance and cannot be used.',
            ], 422);
        }

        $hours = round((float) $data['hours_used'], 2);
        DB::transaction(function () use ($usage, $phase, $equipmentId, $equipment, $data, $hours) {
            $usage->update([
                'equipment_id' => $equipmentId,
                'phase_id' => $phase->phase_id,
                'usage_date' => $data['usage_date'],
                'hours_used' => $hours,
                'hourly_rate_at_use' => (float) $equipment->hourly_rental_rate,
            ]);
        });

        return response()->json([
            'message' => 'Equipment log updated.',
            'data' => [
                'equipment_usage_id' => (int) $usage->equipment_usage_id,
                'equipment' => $equipment->equipment_name,
                'hours_used' => $hours,
            ],
        ]);
    }

    /**
     * Void an equipment entry and refund the project budget.
     */
    public function destroyEquipmentUsage(Request $request, int $id): JsonResponse
    {
        $usage = EquipmentUsage::find($id);

        if (! $usage) {
            return response()->json(['message' => 'Equipment log not found.'], 404);
        }

        $phase = $this->phaseFor($this->projectIds($request), (int) $usage->phase_id);

        if (! $phase) {
            return response()->json(['message' => 'You can only void logs from your own site.'], 403);
        }

        DB::transaction(function () use ($usage) {
            $usage->delete();
        });

        return response()->json(['message' => 'Equipment log voided and the budget refunded.']);
    }
}
