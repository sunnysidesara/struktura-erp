<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Skill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SkillController extends Controller
{
    public function index(): JsonResponse
    {
        $skills = DB::table('skill')
            ->leftJoin('laborer_skills', 'laborer_skills.skill_id', '=', 'skill.skill_id')
            ->select(
                'skill.skill_id',
                'skill.skill_name',
                'skill.description',
                'skill.category',
                DB::raw('COUNT(laborer_skills.laborer_skill_id) as laborer_count')
            )
            ->groupBy('skill.skill_id', 'skill.skill_name', 'skill.description', 'skill.category')
            ->orderBy('skill.category')
            ->orderBy('skill.skill_name')
            ->get();

        return response()->json(['data' => $skills]);
    }

    public function store(Request $request): JsonResponse
    {
        // Eloquent (not the query builder) so the audit observer fires.
        $skill = Skill::create($this->validated($request));

        return response()->json([
            'message' => 'Skill created successfully.',
            'data' => $skill,
        ], 201);
    }

    public function update(Request $request, int $skill): JsonResponse
    {
        $model = Skill::findOrFail($skill);
        $model->update($this->validated($request, $skill));

        return response()->json([
            'message' => 'Skill updated successfully.',
            'data' => $model->fresh(),
        ]);
    }

    public function destroy(int $skill): JsonResponse
    {
        $model = Skill::findOrFail($skill);

        $inUse = DB::table('laborer_skills')->where('skill_id', $model->skill_id)->exists();

        if ($inUse) {
            return response()->json([
                'message' => 'This skill is assigned to laborers and cannot be deleted.',
            ], 422);
        }

        $model->delete();

        return response()->json(['message' => 'Skill deleted successfully.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?int $skillId = null): array
    {
        return $request->validate([
            'skill_name' => [
                'required', 'string', 'max:100',
                Rule::unique('skill', 'skill_name')->ignore($skillId, 'skill_id'),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);
    }
}
