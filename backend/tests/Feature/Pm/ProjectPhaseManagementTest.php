<?php

namespace Tests\Feature\Pm;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProjectPhaseManagementTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'audit_logs',
            'site_task',
            'labor_hour_log',
            'workforce_assignment',
            'material_usage',
            'equipment_usage',
            'project_phases',
            'projects',
            'skill',
            'role',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('role', function (Blueprint $table) {
            $table->increments('role_id');
            $table->string('role_name');
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('project_id');
            $table->string('project_name');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('site_supervisor_id')->nullable();
            $table->string('client_name')->nullable();
            $table->string('location')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->decimal('approved_budget', 15, 2)->default(0);
            $table->decimal('materials_budget', 15, 2)->default(0);
            $table->decimal('equipment_budget', 15, 2)->default(0);
            $table->decimal('remaining_budget', 15, 2)->default(0);
            $table->string('status')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->increments('phase_id');
            $table->unsignedBigInteger('project_id');
            $table->string('project_name')->nullable();
            $table->string('description')->nullable();
            $table->unsignedInteger('sequence_no')->nullable();
            $table->decimal('project_cost', 15, 2)->nullable();
            $table->decimal('materials_budget', 15, 2)->default(0);
            $table->decimal('equipment_budget', 15, 2)->default(0);
            $table->date('planned_start')->nullable();
            $table->date('planned_end')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('completion_requested_at')->nullable();
            $table->unsignedBigInteger('completion_requested_by')->nullable();
            $table->unsignedBigInteger('required_skill_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('site_task', function (Blueprint $table) {
            $table->increments('task_id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('phase_id')->nullable();
            $table->string('title');
            $table->date('task_date')->nullable();
            $table->string('status')->default('Pending');
        });

        Schema::create('workforce_assignment', function (Blueprint $table) {
            $table->increments('assignment_id');
            $table->unsignedBigInteger('phase_id');
        });

        Schema::create('labor_hour_log', function (Blueprint $table) {
            $table->increments('log_id');
            $table->unsignedBigInteger('assignment_id');
        });

        Schema::create('material_usage', function (Blueprint $table) {
            $table->increments('material_usage_id');
            $table->unsignedBigInteger('phase_id');
        });

        Schema::create('equipment_usage', function (Blueprint $table) {
            $table->increments('equipment_usage_id');
            $table->unsignedBigInteger('phase_id');
        });

        Schema::create('skill', function (Blueprint $table) {
            $table->increments('skill_id');
            $table->string('skill_name');
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->increments('audit_log_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('table_name');
            $table->unsignedBigInteger('record_id');
            $table->string('action_type');
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->unsignedBigInteger('changed_by')->nullable();
            $table->timestamp('charge_at')->nullable();
        });

        $this->seedData();
    }

    private function seedData(): void
    {
        DB::table('role')->insert([
            'role_id' => 2,
            'role_name' => Role::SITE_SUPERVISOR,
        ]);

        DB::table('skill')->insert([
            'skill_id' => 1,
            'skill_name' => 'Mason',
        ]);

        DB::table('projects')->insert([
            'project_id' => 1,
            'project_name' => 'Project Alpha',
            'user_id' => 1000,
            'site_supervisor_id' => 2000,
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'approved_budget' => 100000,
            'materials_budget' => 50000,
            'equipment_budget' => 15000,
            'remaining_budget' => 100000,
            'status' => 'On Track',
            'created_by' => 1000,
            'updated_by' => 1000,
        ]);

        DB::table('project_phases')->insert([
            'phase_id' => 1,
            'project_id' => 1,
            'project_name' => 'Foundation',
            'description' => 'Initial foundation work',
            'sequence_no' => 1,
            'project_cost' => 500,
            'materials_budget' => 100,
            'equipment_budget' => 50,
            'planned_start' => '2026-02-01',
            'planned_end' => '2026-03-01',
            'status' => 'Not Started',
            'required_skill_id' => 1,
            'created_by' => 1000,
            'updated_by' => 1000,
        ]);
    }

    private function actingAsRole(string $roleName, int $userId, string $idNumber): User
    {
        $role = new Role(['role_name' => $roleName]);
        $user = new User;
        $user->user_id = $userId;
        $user->id_number = $idNumber;
        $user->first_name = 'Test';
        $user->last_name = ucfirst(strtolower($roleName));
        $user->email = strtolower($idNumber).'@example.test';
        $user->is_active = true;
        $user->setRelation('role', $role);

        $this->actingAs($user, 'sanctum');

        return $user;
    }

    public function test_project_dates_cannot_be_inverted(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->putJson('/api/v1/pm/projects/1', [
            'project_name' => 'Project Alpha',
            'start_date' => '2026-06-10',
            'end_date' => '2026-06-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('end_date');
    }

    public function test_project_cannot_be_edited_by_another_pm(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1001, 'PM020002');

        $this->putJson('/api/v1/pm/projects/1', [
            'project_name' => 'Unauthorized update',
        ])->assertForbidden();
    }

    public function test_phase_dates_must_be_ordered_and_inside_the_project(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->putJson('/api/v1/pm/phases/1', [
            'phase_name' => 'Foundation',
            'planned_start' => '2026-04-10',
            'planned_end' => '2026-04-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('planned_end');

        $this->putJson('/api/v1/pm/phases/1', [
            'phase_name' => 'Foundation',
            'planned_start' => '2025-12-31',
            'planned_end' => '2026-02-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('planned_start');

        $this->putJson('/api/v1/pm/phases/1', [
            'phase_name' => 'Foundation',
            'planned_start' => '2026-02-01',
            'planned_end' => '2027-01-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('planned_end');
    }

    public function test_phase_date_validation_uses_existing_dates_when_one_boundary_is_omitted(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->putJson('/api/v1/pm/phases/1', [
            'phase_name' => 'Foundation',
            'planned_start' => '2026-04-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('planned_end');
    }

    public function test_phase_update_preserves_omitted_skill_and_budgets(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->putJson('/api/v1/pm/phases/1', [
            'phase_name' => 'Foundation Updated',
        ])->assertOk();

        $row = DB::table('project_phases')->where('phase_id', 1)->first();

        $this->assertSame('Foundation Updated', $row->project_name);
        $this->assertSame(1, (int) $row->required_skill_id);
        $this->assertSame(100.0, (float) $row->materials_budget);
        $this->assertSame(50.0, (float) $row->equipment_budget);
        $this->assertSame(500.0, (float) $row->project_cost);
        $this->assertSame('2026-02-01', $row->planned_start);
        $this->assertSame('2026-03-01', $row->planned_end);
    }

    public function test_phase_allocation_cannot_exceed_project_budgets(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->postJson('/api/v1/pm/phases', [
            'project_id' => 1,
            'phase_name' => 'Over Budget Phase',
            'sequence_no' => 2,
            'project_cost' => 100000,
            'materials_budget' => 0,
            'equipment_budget' => 0,
        ])->assertStatus(422)
            ->assertJsonValidationErrors('project_cost')
            ->assertJsonPath(
                'errors.project_cost.0',
                'Invalid: The set budget exceeds the allocated budget limit.',
            );
    }

    public function test_phase_deletion_is_blocked_by_tasks_and_started_status(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        DB::table('site_task')->insert([
            'task_id' => 1,
            'project_id' => 1,
            'phase_id' => 1,
            'title' => 'Inspect foundation',
            'task_date' => '2026-02-05',
            'status' => 'Pending',
        ]);

        $this->deleteJson('/api/v1/pm/phases/1')
            ->assertStatus(422)
            ->assertJsonPath('message', 'This phase has site tasks and cannot be deleted.');

        DB::table('site_task')->delete();
        DB::table('project_phases')->where('phase_id', 1)->update([
            'status' => 'In Progress',
        ]);

        $this->deleteJson('/api/v1/pm/phases/1')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only a Not Started phase can be deleted.');

        DB::table('project_phases')->where('phase_id', 1)->update([
            'status' => 'Not Started',
        ]);

        $this->deleteJson('/api/v1/pm/phases/1')
            ->assertOk()
            ->assertJsonPath('message', 'Phase deleted successfully.');

        $this->assertDatabaseMissing('project_phases', ['phase_id' => 1]);
    }

    public function test_duplicate_completion_requests_are_rejected(): void
    {
        DB::table('project_phases')->where('phase_id', 1)->update([
            'status' => 'In Progress',
        ]);

        DB::table('site_task')->insert([
            'task_id' => 1,
            'project_id' => 1,
            'phase_id' => 1,
            'title' => 'Finished task',
            'task_date' => '2026-02-05',
            'status' => 'Done',
        ]);

        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->postJson('/api/v1/ss/phases/1/request-completion')
            ->assertOk();

        $this->postJson('/api/v1/ss/phases/1/request-completion')
            ->assertStatus(422)
            ->assertJsonPath('message', 'A completion request is already pending for this phase.');
    }
}

