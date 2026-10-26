<?php

namespace Tests\Feature\Pm;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TaskManagementTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'site_task',
            'labor_hour_log',
            'workforce_assignment',
            'laborer_skills',
            'skill',
            'project_phases',
            'laborer',
            'projects',
            'audit_logs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('project_id');
            $table->string('project_name');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('site_supervisor_id')->nullable();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->increments('phase_id');
            $table->unsignedBigInteger('project_id');
            $table->string('project_name')->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('sequence_no')->default(0);
            $table->date('planned_start')->nullable();
            $table->date('planned_end')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('completion_requested_at')->nullable();
            $table->unsignedBigInteger('required_skill_id')->nullable();
        });

        Schema::create('laborer', function (Blueprint $table) {
            $table->increments('laborer_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->decimal('hourly_rate', 15, 2)->default(0);
            $table->string('employment_status')->nullable();
        });

        Schema::create('skill', function (Blueprint $table) {
            $table->increments('skill_id');
            $table->string('skill_name');
        });

        Schema::create('laborer_skills', function (Blueprint $table) {
            $table->increments('laborer_skill_id');
            $table->unsignedBigInteger('laborer_id');
            $table->unsignedBigInteger('skill_id');
        });

        Schema::create('workforce_assignment', function (Blueprint $table) {
            $table->increments('assignment_id');
            $table->unsignedBigInteger('laborer_id');
            $table->unsignedBigInteger('phase_id');
            $table->timestamp('assigned_at')->nullable();
            $table->string('role_on_task')->nullable();
            $table->string('status')->nullable();
            $table->decimal('hourly_rate_ovveride', 15, 2)->nullable();
            $table->timestamp('released_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('site_task', function (Blueprint $table) {
            $table->increments('task_id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('phase_id')->nullable();
            $table->string('title');
            $table->date('task_date');
            $table->time('start_time')->nullable();
            $table->unsignedBigInteger('assigned_laborer_id')->nullable();
            $table->string('status')->default('Pending');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('labor_hour_log', function (Blueprint $table) {
            $table->increments('log_id');
            $table->unsignedBigInteger('assignment_id');
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

        DB::table('projects')->insert([
            ['project_id' => 1, 'project_name' => 'Schedule Project', 'user_id' => 1000, 'site_supervisor_id' => 2000],
            ['project_id' => 2, 'project_name' => 'Other Project', 'user_id' => 999, 'site_supervisor_id' => 2001],
        ]);

        DB::table('project_phases')->insert([
            'phase_id' => 1,
            'project_id' => 1,
            'project_name' => 'Phase One',
            'sequence_no' => 1,
            'status' => 'In Progress',
        ]);

        DB::table('laborer')->insert([
            'laborer_id' => 1,
            'first_name' => 'Task',
            'last_name' => 'Worker',
            'hourly_rate' => 250,
            'employment_status' => 'Active',
        ]);

        DB::table('workforce_assignment')->insert([
            'laborer_id' => 1,
            'phase_id' => 1,
            'assigned_at' => now(),
            'status' => 'Active',
        ]);

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::connection()->getPdo()->sqliteCreateFunction(
                'CURDATE',
                fn () => now()->toDateString(),
            );
        }
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

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'project_id' => 1,
            'phase_id' => 1,
            'title' => 'Pour footing',
            'task_date' => '2026-10-25',
            'start_time' => '08:00',
            'assigned_laborer_id' => 1,
        ], $overrides);
    }

    private function createTask(): int
    {
        return (int) $this->postJson('/api/v1/pm/tasks', $this->payload())
            ->assertCreated()
            ->json('data.task_id');
    }

    public function test_pm_can_create_update_list_and_delete_a_task(): void
    {
        $id = $this->createTask();

        $this->putJson("/api/v1/pm/tasks/{$id}", $this->payload([
            'title' => 'Pour footing - updated',
        ]))
            ->assertOk()
            ->assertJsonPath('data.title', 'Pour footing - updated')
            ->assertJsonPath('data.status', 'Pending');

        $this->getJson('/api/v1/pm/tasks?project_id=1')
            ->assertOk()
            ->assertJsonPath('data.0.task_id', $id)
            ->assertJsonPath('data.0.phase', 'Phase One')
            ->assertJsonPath('data.0.assignee', 'Task Worker');

        $this->deleteJson("/api/v1/pm/tasks/{$id}")
            ->assertOk()
            ->assertJsonPath('message', 'Task deleted successfully.');

        $this->assertDatabaseMissing('site_task', ['task_id' => $id]);
        $this->assertDatabaseCount('audit_logs', 3);
    }

    public function test_pm_cannot_create_tasks_for_another_project(): void
    {
        $this->postJson('/api/v1/pm/tasks', $this->payload([
            'project_id' => 2,
        ]))
            ->assertForbidden()
            ->assertJsonPath('message', 'You can only create tasks for your own projects.');
    }

    public function test_task_validation_rejects_missing_fields_and_invalid_values(): void
    {
        $this->postJson('/api/v1/pm/tasks', [
            'project_id' => 1,
            'title' => '',
            'task_date' => '',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'task_date']);

        DB::table('project_phases')->insert([
            'phase_id' => 2,
            'project_id' => 2,
            'project_name' => 'Other Phase',
            'sequence_no' => 1,
            'status' => 'In Progress',
        ]);

        $this->postJson('/api/v1/pm/tasks', $this->payload([
            'phase_id' => 2,
        ]))
            ->assertStatus(422)
            ->assertJsonPath('message', 'The selected phase does not belong to that project.');
    }

    public function test_ss_can_complete_a_task_and_phase_progress_reflects_it(): void
    {
        $id = $this->createTask();

        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->putJson("/api/v1/ss/tasks/{$id}/status", ['status' => 'Done'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Task status cannot move from Pending to Done.');

        $this->putJson("/api/v1/ss/tasks/{$id}/status", ['status' => 'In Progress'])
            ->assertOk()
            ->assertJsonPath('message', 'Task status updated.')
            ->assertJsonPath('data.status', 'In Progress');

        $this->putJson("/api/v1/ss/tasks/{$id}/status", ['status' => 'Done'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Done');

        $this->getJson('/api/v1/ss/schedule?scope=all&project_id=1')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'Done');

        $this->getJson('/api/v1/ss/phases?project_id=1')
            ->assertOk()
            ->assertJsonPath('data.0.progress', 100);
    }

    public function test_task_cannot_start_until_the_project_manager_starts_the_phase(): void
    {
        $id = $this->createTask();
        DB::table('project_phases')->where('phase_id', 1)->update(['status' => 'Not Started']);

        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->putJson("/api/v1/ss/tasks/{$id}/status", ['status' => 'In Progress'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The Project Manager must start this phase before the task can begin.');

        DB::table('project_phases')->where('phase_id', 1)->update(['status' => 'In Progress']);

        $this->putJson("/api/v1/ss/tasks/{$id}/status", ['status' => 'In Progress'])
            ->assertOk()
            ->assertJsonPath('data.status', 'In Progress');
    }

    public function test_pm_can_start_a_site_task(): void
    {
        $id = $this->createTask();

        $this->putJson("/api/v1/pm/tasks/{$id}/status", ['status' => 'In Progress'])
            ->assertOk()
            ->assertJsonPath('data.status', 'In Progress');
    }

    public function test_site_supervisor_cannot_manage_task_definitions(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->postJson('/api/v1/pm/tasks', $this->payload())
            ->assertForbidden();

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');
        $id = $this->createTask();

        $this->putJson("/api/v1/ss/tasks/{$id}/status", ['status' => 'Done'])
            ->assertForbidden();
    }

    public function test_task_worker_must_be_actively_assigned_to_the_phase(): void
    {
        DB::table('laborer')->insert([
            'laborer_id' => 2,
            'first_name' => 'Unassigned',
            'last_name' => 'Worker',
            'hourly_rate' => 250,
            'employment_status' => 'Active',
        ]);

        $this->postJson('/api/v1/pm/tasks', $this->payload(['assigned_laborer_id' => 2]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('assigned_laborer_id');

        $this->assertDatabaseCount('site_task', 0);
        $this->assertDatabaseCount('workforce_assignment', 1);
    }

    public function test_project_level_task_cannot_have_a_worker(): void
    {
        $this->postJson('/api/v1/pm/tasks', $this->payload([
            'phase_id' => null,
            'assigned_laborer_id' => 1,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('assigned_laborer_id');

        $this->assertDatabaseCount('site_task', 0);
    }

    public function test_project_level_task_without_a_worker_is_allowed(): void
    {
        $this->postJson('/api/v1/pm/tasks', $this->payload([
            'phase_id' => null,
            'assigned_laborer_id' => null,
        ]))
            ->assertCreated();

        $this->assertDatabaseHas('site_task', [
            'project_id' => 1,
            'phase_id' => null,
            'assigned_laborer_id' => null,
        ]);
        $this->assertDatabaseCount('workforce_assignment', 1);
    }

    public function test_legacy_task_worker_can_be_saved_unchanged(): void
    {
        DB::table('laborer')->insert([
            'laborer_id' => 2,
            'first_name' => 'Historical',
            'last_name' => 'Worker',
            'hourly_rate' => 250,
            'employment_status' => 'Active',
        ]);

        DB::table('site_task')->insert([
            'task_id' => 99,
            'project_id' => 1,
            'phase_id' => 1,
            'title' => 'Legacy task',
            'task_date' => '2026-10-25',
            'assigned_laborer_id' => 2,
            'status' => 'Done',
            'created_by' => 1000,
            'updated_by' => 1000,
        ]);

        $this->putJson('/api/v1/pm/tasks/99', $this->payload([
            'title' => 'Legacy task updated',
            'assigned_laborer_id' => 2,
            'status' => 'Done',
        ]))
            ->assertOk()
            ->assertJsonPath('data.title', 'Legacy task updated')
            ->assertJsonPath('data.assigned_laborer_id', 2);
    }

    public function test_assignment_removal_is_blocked_by_open_tasks(): void
    {
        $this->createTask();

        $assignmentId = (int) DB::table('workforce_assignment')
            ->where('laborer_id', 1)
            ->where('phase_id', 1)
            ->where('status', 'Active')
            ->value('assignment_id');

        $this->deleteJson("/api/v1/pm/assignments/{$assignmentId}")
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This laborer has open tasks on this phase. Reassign or complete those tasks before removing the assignment.',
            );

        $this->assertDatabaseHas('workforce_assignment', ['assignment_id' => $assignmentId]);
    }

    public function test_removing_an_assignment_with_only_done_tasks_is_allowed(): void
    {
        $assignmentId = (int) DB::table('workforce_assignment')
            ->where('laborer_id', 1)
            ->where('phase_id', 1)
            ->where('status', 'Active')
            ->value('assignment_id');

        DB::table('site_task')->insert([
            'project_id' => 1,
            'phase_id' => 1,
            'title' => 'Completed task',
            'task_date' => '2026-10-25',
            'assigned_laborer_id' => 1,
            'status' => 'Done',
            'created_by' => 1000,
            'updated_by' => 1000,
        ]);

        $this->deleteJson("/api/v1/pm/assignments/{$assignmentId}")
            ->assertOk()
            ->assertJsonPath('message', 'Laborer removed from the phase.');

        $this->assertDatabaseMissing('workforce_assignment', ['assignment_id' => $assignmentId]);
    }

}
