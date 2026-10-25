<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\SiteTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    private const STATUSES = ['Pending', 'In Progress', 'Done'];
    private const TRANSITIONS = [
        'Pending' => ['In Progress'],
        'In Progress' => ['Done'],
        'Done' => [],
    ];

    /**
     * Tasks for the PM's projects (or every project for an Admin).
     */
    public function index(Request $request): JsonResponse
    {
        $ids = $this->projectIds($request, false);
        $selected = (int) $request->query('project_id', 0);

        if ($selected > 0) {
            if (! in_array($selected, $ids, true)) {
                return response()->json(['data' => []]);
            }

            $ids = [$selected];
        }

        if ($ids === []) {
            return response()->json(['data' => []]);
        }

        return response()->json(['data' => $this->taskRows($ids)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        if (! $this->canUseProject($request, (int) $data['project_id'])) {
            return response()->json([
                'message' => 'You can only create tasks for your own projects.',
            ], 403);
        }

        if (! $this->phaseBelongs((int) $data['project_id'], $data['phase_id'] ?? null)) {
            return response()->json([
                'message' => 'The selected phase does not belong to that project.',
            ], 422);
        }

        $this->assertWorkerAssignment($data);

        $task = SiteTask::create([
            'project_id' => $data['project_id'],
            'phase_id' => $data['phase_id'] ?? null,
            'title' => $data['title'],
            'task_date' => $data['task_date'],
            'start_time' => $data['start_time'] ?? null,
            'assigned_laborer_id' => $data['assigned_laborer_id'] ?? null,
            'status' => 'Pending',
            'created_by' => $request->user()->user_id,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Task created successfully.',
            'data' => $this->taskPayload((int) $task->task_id),
        ], 201);
    }

    public function update(Request $request, SiteTask $task): JsonResponse
    {
        if (! in_array((int) $task->project_id, $this->projectIds($request, false), true)) {
            return response()->json([
                'message' => 'You can only edit tasks in your own projects.',
            ], 403);
        }

        $data = $this->validated($request);

        if (! $this->canUseProject($request, (int) $data['project_id'])) {
            return response()->json([
                'message' => 'You can only move tasks to your own projects.',
            ], 403);
        }

        if (! $this->phaseBelongs((int) $data['project_id'], $data['phase_id'] ?? null)) {
            return response()->json([
                'message' => 'The selected phase does not belong to that project.',
            ], 422);
        }

        $this->assertWorkerAssignment($data, $task);

        $task->update([
            'project_id' => $data['project_id'],
            'phase_id' => $data['phase_id'] ?? null,
            'title' => $data['title'],
            'task_date' => $data['task_date'],
            'start_time' => $data['start_time'] ?? null,
            'assigned_laborer_id' => $data['assigned_laborer_id'] ?? null,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Task updated successfully.',
            'data' => $this->taskPayload((int) $task->task_id),
        ]);
    }

    public function destroy(Request $request, SiteTask $task): JsonResponse
    {
        if (! in_array((int) $task->project_id, $this->projectIds($request, false), true)) {
            return response()->json([
                'message' => 'You can only delete tasks in your own projects.',
            ], 403);
        }

        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
    }

    /**
     * A Site Supervisor may only change the status of a task on their site.
     */
    public function updateStatus(Request $request, SiteTask $task): JsonResponse
    {
        if (! in_array((int) $task->project_id, $this->projectIds($request, true), true)) {
            return response()->json([
                'message' => 'That task does not belong to your site.',
            ], 403);
        }

        $data = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
        ]);

        $current = $task->status;
        $allowed = self::TRANSITIONS[$current] ?? [];

        if (! in_array($data['status'], $allowed, true)) {
            return response()->json([
                'message' => 'Task status cannot move from '.$current.' to '.$data['status'].'.',
            ], 422);
        }

        $task->update([
            'status' => $data['status'],
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Task status updated.',
            'data' => $this->taskPayload((int) $task->task_id),
        ]);
    }

    /**
     * A task worker is a responsibility link only; phase membership must
     * already exist. Task saves never create workforce assignments.
     *
     * @param  array<string, mixed>  $data
     */
    private function assertWorkerAssignment(array $data, ?SiteTask $task = null): void
    {
        $laborerId = $data['assigned_laborer_id'] ?? null;

        if ($laborerId === null || $laborerId === '') {
            return;
        }

        $phaseId = $data['phase_id'] ?? null;

        if ($phaseId === null || $phaseId === '') {
            throw ValidationException::withMessages([
                'assigned_laborer_id' => 'Select a phase before assigning a worker.',
            ]);
        }

        $phaseId = (int) $phaseId;
        $laborerId = (int) $laborerId;

        // Historical tasks may keep their existing worker while the phase and
        // worker are unchanged; changing either requires a current assignment.
        if (
            $task
            && (int) $task->phase_id === $phaseId
            && (int) $task->assigned_laborer_id === $laborerId
        ) {
            return;
        }

        $hasAssignment = DB::table('workforce_assignment as wa')
            ->join('laborer as l', 'l.laborer_id', '=', 'wa.laborer_id')
            ->where('wa.laborer_id', $laborerId)
            ->where('wa.phase_id', $phaseId)
            ->where('wa.status', 'Active')
            ->where('l.employment_status', 'Active')
            ->exists();

        if (! $hasAssignment) {
            throw ValidationException::withMessages([
                'assigned_laborer_id' => 'The selected worker is not actively assigned to this phase. Assign the worker to the phase first.',
            ]);
        }
    }

    /**
     * @return array<int, int>
     */
    private function projectIds(Request $request, bool $supervisor): array
    {
        $user = $request->user();
        $query = DB::table('projects');

        if ($user->role?->role_name !== Role::ADMIN) {
            $query->where($supervisor ? 'site_supervisor_id' : 'user_id', $user->user_id);
        }

        return array_map('intval', $query->pluck('project_id')->all());
    }

    private function canUseProject(Request $request, int $projectId): bool
    {
        return in_array($projectId, $this->projectIds($request, false), true);
    }

    private function phaseBelongs(int $projectId, mixed $phaseId): bool
    {
        if ($phaseId === null || $phaseId === '') {
            return true;
        }

        return DB::table('project_phases')
            ->where('phase_id', (int) $phaseId)
            ->where('project_id', $projectId)
            ->exists();
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'project_id' => ['required', 'integer', Rule::exists('projects', 'project_id')],
            'phase_id' => ['nullable', 'integer', Rule::exists('project_phases', 'phase_id')],
            'title' => ['required', 'string', 'max:255'],
            'task_date' => ['required', 'date'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'assigned_laborer_id' => ['nullable', 'integer', Rule::exists('laborer', 'laborer_id')],
        ]);
    }

    /**
     * @param  array<int, int>  $projectIds
     * @return array<int, array<string, mixed>>
     */
    private function taskRows(array $projectIds): array
    {
        return $this->taskQuery()
            ->whereIn('t.project_id', $projectIds)
            ->orderBy('t.task_date')
            ->orderBy('t.start_time')
            ->orderBy('t.task_id')
            ->get()
            ->map(fn (object $row) => $this->formatRow($row))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function taskPayload(int $taskId): array
    {
        $row = $this->taskQuery()->where('t.task_id', $taskId)->first();

        return $row ? $this->formatRow($row) : [];
    }

    private function taskQuery(): \Illuminate\Database\Query\Builder
    {
        return DB::table('site_task as t')
            ->leftJoin('project_phases as ph', 'ph.phase_id', '=', 't.phase_id')
            ->leftJoin('laborer as l', 'l.laborer_id', '=', 't.assigned_laborer_id')
            ->leftJoin('projects as p', 'p.project_id', '=', 't.project_id')
            ->select(
                't.task_id',
                't.project_id',
                't.phase_id',
                't.title',
                't.task_date',
                't.start_time',
                't.assigned_laborer_id',
                't.status',
                'ph.project_name as phase_name',
                'l.first_name',
                'l.last_name',
                'p.project_name'
            );
    }

    /**
     * @return array<string, mixed>
     */
    private function formatRow(object $row): array
    {
        return [
            'id' => 'TSK-'.$row->task_id,
            'task_id' => (int) $row->task_id,
            'project_id' => (int) $row->project_id,
            'project' => $row->project_name,
            'phase_id' => $row->phase_id !== null ? (int) $row->phase_id : null,
            'phase' => $row->phase_name,
            'title' => $row->title,
            'date' => $row->task_date,
            'time' => $row->start_time ? substr((string) $row->start_time, 0, 5) : '',
            'assigned_laborer_id' => $row->assigned_laborer_id !== null
                ? (int) $row->assigned_laborer_id
                : null,
            'assignee' => trim(($row->first_name ?? '').' '.($row->last_name ?? '')) ?: 'Unassigned',
            'status' => $row->status,
        ];
    }
}
