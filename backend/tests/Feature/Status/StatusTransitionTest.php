<?php

namespace Tests\Feature\Status;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class StatusTransitionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'site_task',
            'project_phases',
            'projects',
            'laborer',
            'workforce_assignment',
            'equipment',
            'audit_logs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('project_id');
            $table->string('project_name');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('site_supervisor_id')->nullable();
            $table->string('status')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->increments('phase_id');
            $table->unsignedBigInteger('project_id');
            $table->string('project_name')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('completion_requested_at')->nullable();
            $table->unsignedBigInteger('completion_requested_by')->nullable();
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

        Schema::create('laborer', function (Blueprint $table) {
            $table->increments('laborer_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->decimal('hourly_rate', 15, 2)->default(0);
            $table->string('employment_status')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
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
            $table->string('status')->nullable();
        });

        Schema::create('equipment', function (Blueprint $table) {
            $table->increments('equipment_id');
            $table->string('equipment_name');
            $table->string('equipment_status')->nullable();
            $table->decimal('hourly_rental_rate', 15, 2)->default(0);
            $table->unsignedBigInteger('updated_by')->nullable();
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
        DB::table('projects')->insert([
            ['project_id' => 1, 'project_name' => 'Own Project', 'user_id' => 1000, 'site_supervisor_id' => 2000, 'status' => 'Not Started'],
            ['project_id' => 2, 'project_name' => 'Other Project', 'user_id' => 999, 'site_supervisor_id' => 2001, 'status' => 'Not Started'],
        ]);

        DB::table('project_phases')->insert([
            ['phase_id' => 1, 'project_id' => 1, 'project_name' => 'Not started phase', 'status' => 'Not Started'],
            ['phase_id' => 3, 'project_id' => 1, 'project_name' => 'Ready phase', 'status' => 'In Progress'],
        ]);

        DB::table('project_phases')->insert([
            'phase_id' => 2,
            'project_id' => 1,
            'project_name' => 'Open task phase',
            'status' => 'In Progress',
            'completion_requested_at' => now(),
        ]);

        DB::table('site_task')->insert([
            ['task_id' => 1, 'project_id' => 1, 'phase_id' => 2, 'title' => 'Open task', 'status' => 'Pending'],
            ['task_id' => 2, 'project_id' => 1, 'phase_id' => 3, 'title' => 'Finished task', 'status' => 'Done'],
        ]);

        DB::table('laborer')->insert([
            ['laborer_id' => 1, 'first_name' => 'Free', 'last_name' => 'Worker', 'hourly_rate' => 100, 'employment_status' => 'Active'],
            ['laborer_id' => 2, 'first_name' => 'Assigned', 'last_name' => 'Worker', 'hourly_rate' => 100, 'employment_status' => 'Active'],
        ]);

        DB::table('workforce_assignment')->insert([
            ['laborer_id' => 2, 'status' => 'Active'],
        ]);

        DB::table('equipment')->insert([
            'equipment_id' => 1,
            'equipment_name' => 'Mixer',
            'equipment_status' => 'Available',
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

    public function test_project_status_uses_allowed_transitions_and_ownership(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->patchJson('/api/v1/pm/projects/1/status', ['status' => 'Completed'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Project status cannot move from Not Started to Completed.');

        $this->patchJson('/api/v1/pm/projects/1/status', ['status' => 'On Track'])
            ->assertOk()
            ->assertJsonPath('data.status', 'On Track');

        $this->patchJson('/api/v1/pm/projects/1/status', ['status' => 'Completed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Completed');

        $this->patchJson('/api/v1/pm/projects/1/status', ['status' => 'On Hold'])
            ->assertStatus(422);

        $this->patchJson('/api/v1/pm/projects/2/status', ['status' => 'On Track'])
            ->assertForbidden();
    }

    public function test_phase_completion_requires_done_tasks_and_a_request(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->patchJson('/api/v1/pm/phases/1/start')
            ->assertOk()
            ->assertJsonPath('data.status', 'In Progress');

        $this->patchJson('/api/v1/pm/phases/2/approve-completion')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Complete all phase tasks before approving completion.');

        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->postJson('/api/v1/ss/phases/2/request-completion')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Complete all phase tasks before requesting completion.');

        $this->postJson('/api/v1/ss/phases/3/request-completion')
            ->assertOk();

        $this->assertDatabaseHas('project_phases', [
            'phase_id' => 3,
            'completion_requested_by' => 2000,
        ]);

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->patchJson('/api/v1/pm/phases/3/approve-completion')
            ->assertOk()
            ->assertJsonPath('data.status', 'Completed');

        $this->assertDatabaseHas('project_phases', [
            'phase_id' => 3,
            'status' => 'Completed',
            'completion_requested_at' => null,
        ]);
    }

    public function test_site_supervisor_cannot_start_or_approve_a_phase(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->patchJson('/api/v1/pm/phases/1/start')->assertForbidden();
        $this->patchJson('/api/v1/pm/phases/2/approve-completion')->assertForbidden();
    }

    public function test_pm_can_reject_a_completion_request_without_completing_the_phase(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->patchJson('/api/v1/pm/phases/2/reject-completion')
            ->assertOk()
            ->assertJsonPath('data.status', 'In Progress')
            ->assertJsonPath('data.completion_requested_at', null);

        $this->patchJson('/api/v1/pm/phases/2/approve-completion')
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'The Site Supervisor has not requested completion for this phase.',
            );
    }


    public function test_laborer_status_requires_valid_transitions_and_no_active_work(): void
    {
        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->patchJson('/api/v1/pm/laborers/1/status', ['status' => 'Terminated'])
            ->assertOk()
            ->assertJsonPath('data.employment_status', 'Terminated');

        $this->patchJson('/api/v1/pm/laborers/1/status', ['status' => 'Active'])
            ->assertStatus(422);

        $this->patchJson('/api/v1/pm/laborers/2/status', ['status' => 'Inactive'])
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This laborer has active assignments or open tasks. Reassign or complete them before changing the worker status.',
            );
    }

    public function test_equipment_status_is_admin_only_and_maintenance_requires_return_to_available(): void
    {
        $this->actingAsRole(Role::ADMIN, 999, 'SYS010001');

        $this->patchJson('/api/v1/admin/equipment/1/status', ['status' => 'In Use'])
            ->assertOk()
            ->assertJsonPath('data.equipment_status', 'In Use');

        $this->patchJson('/api/v1/admin/equipment/1/status', ['status' => 'Under Maintenance'])
            ->assertOk();

        $this->patchJson('/api/v1/admin/equipment/1/status', ['status' => 'In Use'])
            ->assertStatus(422);

        $this->patchJson('/api/v1/admin/equipment/1/status', ['status' => 'Available'])
            ->assertOk();

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');
        $this->patchJson('/api/v1/admin/equipment/1/status', ['status' => 'In Use'])
            ->assertForbidden();
    }

    public function test_equipment_under_maintenance_cannot_receive_new_usage(): void
    {
        DB::table('equipment')->where('equipment_id', 1)->update([
            'equipment_status' => 'Under Maintenance',
        ]);

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        $this->postJson('/api/v1/pm/equipment-usage', [
            'equipment_id' => 1,
            'phase_id' => 2,
            'usage_date' => now()->toDateString(),
            'hours_used' => 2,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This equipment is under maintenance and cannot be used.');
    }
}
