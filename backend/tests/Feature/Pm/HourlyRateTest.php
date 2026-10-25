<?php

namespace Tests\Feature\Pm;

use App\Models\Role;
use App\Models\User;
use App\Support\CostPostingTriggers;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HourlyRateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'labor_hour_log',
            'material_usage',
            'equipment_usage',
            'workforce_assignment',
            'laborer_skills',
            'skill',
            'project_phases',
            'projects',
            'laborer',
            'audit_logs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('project_id');
            $table->string('project_name');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('site_supervisor_id')->nullable();
            $table->decimal('remaining_budget', 15, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->increments('phase_id');
            $table->unsignedBigInteger('project_id');
            $table->string('project_name')->nullable();
        });

        Schema::create('laborer', function (Blueprint $table) {
            $table->increments('laborer_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->decimal('hourly_rate', 15, 2);
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

        Schema::create('labor_hour_log', function (Blueprint $table) {
            $table->increments('log_id');
            $table->unsignedBigInteger('assignment_id');
            $table->date('log_date');
            $table->string('shift')->nullable();
            $table->time('time_in')->nullable();
            $table->time('time_out')->nullable();
            $table->decimal('regular_hours', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);
            $table->decimal('hourly_rate_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->storedAs(
                'ROUND(COALESCE(regular_hours,0) * COALESCE(hourly_rate_at_use,0) + COALESCE(overtime_hours,0) * COALESCE(hourly_rate_at_use,0) * 1.25, 2)'
            );
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('material_usage', function (Blueprint $table) {
            $table->increments('material_usage_id');
            $table->unsignedBigInteger('phase_id');
            $table->decimal('quantity_used', 8, 2)->default(0);
            $table->decimal('unit_cost_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->storedAs(
                'ROUND(COALESCE(quantity_used,0) * COALESCE(unit_cost_at_use,0), 2)'
            );
        });

        Schema::create('equipment_usage', function (Blueprint $table) {
            $table->increments('equipment_usage_id');
            $table->unsignedBigInteger('phase_id');
            $table->decimal('hours_used', 8, 2)->default(0);
            $table->decimal('hourly_rate_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->storedAs(
                'ROUND(COALESCE(hours_used,0) * COALESCE(hourly_rate_at_use,0), 2)'
            );
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
            'project_id' => 1,
            'project_name' => 'Rate Test Project',
            'user_id' => 1000,
            'site_supervisor_id' => 2000,
            'remaining_budget' => 10000,
        ]);

        DB::table('project_phases')->insert([
            'phase_id' => 1,
            'project_id' => 1,
            'project_name' => 'Rate Test Phase',
        ]);

        DB::table('laborer')->insert([
            'laborer_id' => 1,
            'first_name' => 'Rate',
            'last_name' => 'Tester',
            'hourly_rate' => 250,
            'employment_status' => 'Active',
        ]);

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');

        CostPostingTriggers::install(DB::connection());
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

    private function seedAssignment(?float $override = null): int
    {
        return (int) DB::table('workforce_assignment')->insertGetId([
            'laborer_id' => 1,
            'phase_id' => 1,
            'assigned_at' => now(),
            'role_on_task' => 'Rate Test',
            'status' => 'Active',
            'hourly_rate_ovveride' => $override,
            'created_by' => 1000,
            'updated_by' => 1000,
        ]);
    }

    public function test_pm_assignment_persists_override_and_workforce_returns_it(): void
    {
        $this->postJson('/api/v1/pm/assignments', [
            'laborer_id' => 1,
            'phase_id' => 1,
            'role_on_task' => 'Lead Mason',
            'hourly_rate_ovveride' => 300,
        ])
            ->assertCreated()
            ->assertJsonPath('message', 'Laborer assigned to the phase.');

        $this->assertDatabaseHas('workforce_assignment', [
            'laborer_id' => 1,
            'hourly_rate_ovveride' => 300,
        ]);

        $response = $this->getJson('/api/v1/pm/workforce?project_id=1')
            ->assertOk();

        $row = collect($response->json('assigned'))->firstWhere('laborer_id', 1);

        $this->assertNotNull($row);
        $this->assertSame(250.0, (float) $row['hourly_rate']);
        $this->assertSame(300.0, (float) $row['hourly_rate_ovveride']);
    }

    public function test_assignment_override_must_be_greater_than_zero(): void
    {
        $this->postJson('/api/v1/pm/assignments', [
            'laborer_id' => 1,
            'phase_id' => 1,
            'hourly_rate_ovveride' => 0,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('hourly_rate_ovveride');
    }

    public function test_ss_labor_cost_prefers_the_assignment_override(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');
        $assignmentId = $this->seedAssignment(300);

        $this->postJson('/api/v1/ss/log-hours', [
            'assignment_id' => $assignmentId,
            'log_date' => now()->toDateString(),
            'regular_hours' => 8,
        ])
            ->assertCreated()
            ->assertJsonPath('data.total_hours', 8);

        $log = DB::table('labor_hour_log')->first();

        $this->assertNotNull($log);
        $this->assertSame(2400.0, (float) $log->computed_cost);
        $this->assertSame(7600.0, (float) DB::table('projects')->value('remaining_budget'));
    }

    public function test_ss_labor_cost_falls_back_to_the_laborer_base_rate(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');
        $assignmentId = $this->seedAssignment();

        $this->postJson('/api/v1/ss/log-hours', [
            'assignment_id' => $assignmentId,
            'log_date' => now()->toDateString(),
            'regular_hours' => 4,
        ])->assertCreated();

        $log = DB::table('labor_hour_log')->first();

        $this->assertNotNull($log);
        $this->assertSame(1000.0, (float) $log->computed_cost);
        $this->assertSame(9000.0, (float) DB::table('projects')->value('remaining_budget'));
    }

}
