<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
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
    }    public function assignments(): JsonResponse
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
            'equipment' => DB::table('equipment')->orderBy('equipment_name')->get(),
            'materials' => DB::table('materials')->orderBy('material_name')->get(),
            'suppliers' => DB::table('suppliers')->orderBy('supplier_name')->get(),
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
            return response()->json(['users' => [], 'skills' => [], 'projects' => []]);
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

        return response()->json([
            'users' => $users,
            'skills' => $skills,
            'projects' => $projects,
        ]);
    }
}