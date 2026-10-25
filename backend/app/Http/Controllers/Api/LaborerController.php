<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Laborer;
use App\Models\LaborerSkill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LaborerController extends Controller
{
    private const EMPLOYMENT_STATUSES = ['Active', 'Inactive', 'Terminated'];
    private const EMPLOYMENT_TRANSITIONS = [
        'Active' => ['Inactive', 'Terminated'],
        'Inactive' => ['Active', 'Terminated'],
        'Terminated' => [],
    ];

    /**
     * All laborers with their trade skills. Laborers are shared workforce
     * records, so a PM can manage any of them rather than only their projects.
     */
    public function index(): JsonResponse
    {
        $laborers = Laborer::query()
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        $skills = $this->skillsFor($laborers->pluck('laborer_id')->all());

        return response()->json([
            'data' => $laborers
                ->map(fn (Laborer $laborer) => $this->formatLaborer($laborer, $skills))
                ->values(),
        ]);
    }

    public function show(Laborer $laborer): JsonResponse
    {
        return response()->json([
            'data' => $this->formatLaborer($laborer, $this->skillsFor([$laborer->laborer_id])),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['employment_status'] = 'Active';
        $data['created_by'] = $request->user()->user_id;
        $data['updated_by'] = $request->user()->user_id;

        $laborer = Laborer::create($data);

        return response()->json([
            'message' => 'Laborer created successfully.',
            'data' => $this->formatLaborer($laborer, collect()),
        ], 201);
    }

    public function update(Request $request, Laborer $laborer): JsonResponse
    {
        $data = $this->validated($request);
        $data['updated_by'] = $request->user()->user_id;

        $laborer->update($data);

        return response()->json([
            'message' => 'Laborer updated successfully.',
            'data' => $this->formatLaborer(
                $laborer->fresh(),
                $this->skillsFor([$laborer->laborer_id]),
            ),
        ]);
    }

    public function changeStatus(Request $request, Laborer $laborer): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(self::EMPLOYMENT_STATUSES)],
        ]);

        $current = $laborer->employment_status ?? 'Active';
        $allowed = self::EMPLOYMENT_TRANSITIONS[$current] ?? [];

        if (! in_array($data['status'], $allowed, true)) {
            return response()->json([
                'message' => 'Worker status cannot move from '.$current.' to '.$data['status'].'.',
            ], 422);
        }

        if ($data['status'] !== 'Active') {
            $hasActiveAssignment = DB::table('workforce_assignment')
                ->where('laborer_id', $laborer->laborer_id)
                ->where('status', 'Active')
                ->exists();

            $hasOpenTasks = DB::table('site_task')
                ->where('assigned_laborer_id', $laborer->laborer_id)
                ->whereIn('status', ['Pending', 'In Progress'])
                ->exists();

            if ($hasActiveAssignment || $hasOpenTasks) {
                return response()->json([
                    'message' => 'This laborer has active assignments or open tasks. Reassign or complete them before changing the worker status.',
                ], 422);
            }
        }

        $laborer->update([
            'employment_status' => $data['status'],
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Laborer marked '.$data['status'].'.',
            'data' => $this->formatLaborer($laborer->fresh(), $this->skillsFor([$laborer->laborer_id])),
        ]);
    }

    public function destroy(Laborer $laborer): JsonResponse
    {
        $hasAssignments = DB::table('workforce_assignment')
            ->where('laborer_id', $laborer->laborer_id)
            ->exists();

        $hasLoggedHours = DB::table('labor_hour_log as lhl')
            ->join('workforce_assignment as wa', 'wa.assignment_id', '=', 'lhl.assignment_id')
            ->where('wa.laborer_id', $laborer->laborer_id)
            ->exists();

        $hasTaskHistory = DB::table('site_task')
            ->where('assigned_laborer_id', $laborer->laborer_id)
            ->exists();

        if ($hasAssignments || $hasLoggedHours || $hasTaskHistory) {
            return response()->json([
                'message' => 'This laborer has workforce assignments, logged hours, or site tasks and cannot be deleted.',
            ], 422);
        }

        DB::transaction(function () use ($laborer) {
            // laborer_skills uses ON DELETE RESTRICT, so remove the (now
            // unreferenced) skill links before deleting the profile.
            LaborerSkill::query()
                ->where('laborer_id', $laborer->laborer_id)
                ->get()
                ->each
                ->delete();

            $laborer->delete();
        });

        return response()->json(['message' => 'Laborer deleted successfully.']);
    }


    public function attachSkill(Request $request, Laborer $laborer): JsonResponse
    {
        $data = $request->validate([
            'skill_id' => ['required', 'integer', Rule::exists('skill', 'skill_id')],
        ]);

        $exists = LaborerSkill::query()
            ->where('laborer_id', $laborer->laborer_id)
            ->where('skill_id', $data['skill_id'])
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'This laborer already has that skill.',
            ], 422);
        }

        $skill = DB::table('skill')->where('skill_id', $data['skill_id'])->first();

        $link = LaborerSkill::create([
            'laborer_id' => $laborer->laborer_id,
            'skill_id' => $skill->skill_id,
            'skill_name' => $skill->skill_name,
            'created_by' => $request->user()->user_id,
            'updated_by' => $request->user()->user_id,
        ]);

        return response()->json([
            'message' => 'Skill added to the laborer.',
            'data' => [
                'skill_id' => (int) $link->skill_id,
                'skill_name' => $link->skill_name,
            ],
        ], 201);
    }

    public function detachSkill(Laborer $laborer, int $skill): JsonResponse
    {
        $link = LaborerSkill::query()
            ->where('laborer_id', $laborer->laborer_id)
            ->where('skill_id', $skill)
            ->first();

        if (! $link) {
            return response()->json([
                'message' => 'This laborer does not have that skill.',
            ], 404);
        }

        $link->delete();

        return response()->json(['message' => 'Skill removed from the laborer.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'hourly_rate' => ['required', 'numeric', 'gt:0', 'max:9999999999999.99'],
            'contact_number' => ['nullable', 'string', 'max:50'],
            'date_hired' => ['nullable', 'date'],
        ]);
    }

    /**
     * @param  array<int, int>  $laborerIds
     * @return Collection<int, Collection<int, object>>
     */
    private function skillsFor(array $laborerIds): Collection
    {
        if ($laborerIds === []) {
            return collect();
        }

        return DB::table('laborer_skills as ls')
            ->join('skill as s', 's.skill_id', '=', 'ls.skill_id')
            ->whereIn('ls.laborer_id', $laborerIds)
            ->select('ls.laborer_id', 's.skill_id', 's.skill_name')
            ->orderBy('s.skill_name')
            ->get()
            ->groupBy('laborer_id');
    }

    /**
     * @param  Collection<int, Collection<int, object>>  $skills
     * @return array<string, mixed>
     */
    private function formatLaborer(Laborer $laborer, Collection $skills): array
    {
        return [
            'laborer_id' => (int) $laborer->laborer_id,
            'first_name' => $laborer->first_name,
            'last_name' => $laborer->last_name,
            'full_name' => trim($laborer->first_name.' '.$laborer->last_name),
            'hourly_rate' => $laborer->hourly_rate !== null ? (float) $laborer->hourly_rate : null,
            'employment_status' => $laborer->employment_status,
            'contact_number' => $laborer->contact_number,
            'date_hired' => $laborer->date_hired?->format('Y-m-d'),
            'skills' => $skills->get($laborer->laborer_id, collect())
                ->map(fn (object $skill) => [
                    'skill_id' => (int) $skill->skill_id,
                    'skill_name' => $skill->skill_name,
                ])
                ->values(),
        ];
    }
}
