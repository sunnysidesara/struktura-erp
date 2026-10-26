<?php

namespace Tests\Feature\Pm;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LaborerManagementTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'site_task',
            'labor_hour_log',
            'workforce_assignment',
            'laborer_skills',
            'laborer',
            'skill',
            'audit_logs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('skill', function (Blueprint $table) {
            $table->increments('skill_id');
            $table->string('skill_name');
            $table->string('description')->nullable();
        });

        Schema::create('laborer', function (Blueprint $table) {
            $table->increments('laborer_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->decimal('hourly_rate', 15, 2)->nullable();
            $table->string('employment_status')->nullable();
            $table->string('contact_number')->nullable();
            $table->date('date_hired')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('laborer_skills', function (Blueprint $table) {
            $table->increments('laborer_skill_id');
            $table->unsignedBigInteger('laborer_id');
            $table->unsignedBigInteger('skill_id');
            $table->string('skill_name')->nullable();
            $table->string('proficiency_level')->nullable();
            $table->unsignedInteger('years_experience')->nullable();
            $table->date('date_certified')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unique(['laborer_id', 'skill_id']);
        });

        Schema::create('workforce_assignment', function (Blueprint $table) {
            $table->increments('assignment_id');
            $table->unsignedBigInteger('laborer_id');
            $table->string('status')->nullable();
        });

        Schema::create('site_task', function (Blueprint $table) {
            $table->increments('task_id');
            $table->unsignedBigInteger('assigned_laborer_id')->nullable();
            $table->string('status')->default('Pending');
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

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');
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
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'hourly_rate' => 250,
            'contact_number' => '0917-555-0101',
            'date_hired' => '2026-01-15',
        ], $overrides);
    }

    private function createLaborer(array $overrides = []): int
    {
        return (int) $this->postJson('/api/v1/pm/laborers', $this->payload($overrides))
            ->assertCreated()
            ->json('data.laborer_id');
    }

    private function seedSkill(int $id = 1, string $name = 'Mason'): int
    {
        DB::table('skill')->insert([
            'skill_id' => $id,
            'skill_name' => $name,
        ]);

        return $id;
    }

    public function test_pm_can_create_update_and_list_a_laborer(): void
    {
        $id = $this->createLaborer();

        $this->putJson("/api/v1/pm/laborers/{$id}", $this->payload([
            'first_name' => 'Marietta',
            'hourly_rate' => 275,
        ]))
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Marietta')
            ->assertJsonPath('data.employment_status', 'Active')
            ->assertJsonPath('data.hourly_rate', 275);

        $this->getJson('/api/v1/pm/laborers')
            ->assertOk()
            ->assertJsonPath('data.0.laborer_id', $id)
            ->assertJsonPath('data.0.full_name', 'Marietta Santos')
            ->assertJsonPath('data.0.hourly_rate', 275)
            ->assertJsonPath('data.0.date_hired', '2026-01-15');

        $this->assertDatabaseHas('laborer', [
            'laborer_id' => $id,
            'first_name' => 'Marietta',
            'hourly_rate' => 275,
            'employment_status' => 'Active',
        ]);
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_pm_can_attach_and_detach_trade_skills(): void
    {
        $id = $this->createLaborer();
        $skillId = $this->seedSkill();

        $this->postJson("/api/v1/pm/laborers/{$id}/skills", ['skill_id' => $skillId])
            ->assertCreated()
            ->assertJsonPath('data.skill_name', 'Mason');

        $this->getJson("/api/v1/pm/laborers/{$id}")
            ->assertOk()
            ->assertJsonPath('data.skills.0.skill_id', $skillId)
            ->assertJsonPath('data.skills.0.skill_name', 'Mason');

        $this->postJson("/api/v1/pm/laborers/{$id}/skills", ['skill_id' => $skillId])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This laborer already has that skill.');

        $this->deleteJson("/api/v1/pm/laborers/{$id}/skills/{$skillId}")
            ->assertOk()
            ->assertJsonPath('message', 'Skill removed from the laborer.');

        $this->assertDatabaseMissing('laborer_skills', [
            'laborer_id' => $id,
            'skill_id' => $skillId,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'table_name' => 'laborer_skills',
            'action_type' => 'DELETE',
        ]);
    }


    public function test_laborer_with_assignments_cannot_be_deleted(): void
    {
        $id = $this->createLaborer();

        DB::table('workforce_assignment')->insert(['laborer_id' => $id]);

        $this->deleteJson("/api/v1/pm/laborers/{$id}")
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This laborer has workforce assignments, logged hours, or site tasks and cannot be deleted.',
            );

        $this->assertDatabaseHas('laborer', ['laborer_id' => $id]);
    }

    public function test_unused_laborer_delete_removes_skill_links(): void
    {
        $id = $this->createLaborer();
        $skillId = $this->seedSkill();

        $this->postJson("/api/v1/pm/laborers/{$id}/skills", ['skill_id' => $skillId])
            ->assertCreated();

        $this->deleteJson("/api/v1/pm/laborers/{$id}")
            ->assertOk()
            ->assertJsonPath('message', 'Laborer deleted successfully.');

        $this->assertDatabaseMissing('laborer', ['laborer_id' => $id]);
        $this->assertDatabaseMissing('laborer_skills', ['laborer_id' => $id]);
    }

    public function test_laborer_validation_rejects_missing_names_and_invalid_rate(): void
    {
        $this->postJson('/api/v1/pm/laborers', [
            'first_name' => '',
            'last_name' => '',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['first_name', 'last_name', 'hourly_rate']);

        foreach ([0, -100] as $invalidRate) {
            $this->postJson('/api/v1/pm/laborers', $this->payload([
                'hourly_rate' => $invalidRate,
            ]))
                ->assertStatus(422)
                ->assertJsonValidationErrors('hourly_rate');
        }
    }

    public function test_admin_has_read_only_oversight_of_laborers(): void
    {
        $id = $this->createLaborer();

        $this->actingAsRole(Role::ADMIN, 999, 'SYS010001');

        $this->getJson('/api/v1/pm/laborers')
            ->assertOk()
            ->assertJsonPath('data.0.laborer_id', $id);

        $this->postJson('/api/v1/pm/laborers', $this->payload([
            'first_name' => 'Admin',
            'last_name' => 'Attempt',
        ]))->assertForbidden();
    }

    public function test_laborer_with_an_active_assignment_cannot_be_marked_inactive(): void
    {
        $id = $this->createLaborer();

        DB::table('workforce_assignment')->insert([
            'laborer_id' => $id,
            'status' => 'Active',
        ]);

        $this->patchJson("/api/v1/pm/laborers/{$id}/status", [
            'status' => 'Inactive',
        ])
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This laborer has active assignments or open tasks. Reassign or complete them before changing the worker status.',
            );

        $this->assertDatabaseHas('laborer', [
            'laborer_id' => $id,
            'employment_status' => 'Active',
        ]);
    }

    public function test_laborer_with_open_tasks_cannot_be_marked_terminated(): void
    {
        $id = $this->createLaborer();

        DB::table('site_task')->insert([
            'assigned_laborer_id' => $id,
            'status' => 'Pending',
        ]);

        $this->patchJson("/api/v1/pm/laborers/{$id}/status", [
            'status' => 'Terminated',
        ])
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This laborer has active assignments or open tasks. Reassign or complete them before changing the worker status.',
            );
    }

    public function test_laborer_with_task_history_cannot_be_deleted(): void
    {
        $id = $this->createLaborer();

        DB::table('site_task')->insert([
            'assigned_laborer_id' => $id,
            'status' => 'Done',
        ]);

        $this->deleteJson("/api/v1/pm/laborers/{$id}")
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This laborer has workforce assignments, logged hours, or site tasks and cannot be deleted.',
            );

        $this->assertDatabaseHas('laborer', ['laborer_id' => $id]);
    }

}
