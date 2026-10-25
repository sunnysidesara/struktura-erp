<?php

namespace Tests\Feature\Pm;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class WorkforceAvailabilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'workforce_assignment',
            'laborer_skills',
            'skill',
            'project_phases',
            'projects',
            'laborer',
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
        });

        Schema::create('laborer', function (Blueprint $table) {
            $table->increments('laborer_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->decimal('hourly_rate', 15, 2)->default(0);
            $table->string('employment_status')->nullable();
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

        DB::table('projects')->insert([
            ['project_id' => 1, 'project_name' => 'My Project', 'user_id' => 1000],
            ['project_id' => 2, 'project_name' => 'Other Project', 'user_id' => 2000],
        ]);

        DB::table('project_phases')->insert([
            ['phase_id' => 1, 'project_id' => 1, 'project_name' => 'My Phase'],
            ['phase_id' => 2, 'project_id' => 2, 'project_name' => 'Other Phase'],
            ['phase_id' => 3, 'project_id' => 1, 'project_name' => 'My Second Phase'],
        ]);

        DB::table('laborer')->insert([
            [
                'laborer_id' => 1,
                'first_name' => 'Cross',
                'last_name' => 'Alpha',
                'hourly_rate' => 250,
                'employment_status' => 'Active',
            ],
            [
                'laborer_id' => 2,
                'first_name' => 'Same',
                'last_name' => 'Beta',
                'hourly_rate' => 250,
                'employment_status' => 'Active',
            ],
            [
                'laborer_id' => 3,
                'first_name' => 'Free',
                'last_name' => 'Gamma',
                'hourly_rate' => 250,
                'employment_status' => 'Active',
            ],
        ]);

        $this->actingAsRole();
    }

    private function actingAsRole(): void
    {
        $role = new Role(['role_name' => Role::PROJECT_MANAGER]);
        $user = new User;
        $user->user_id = 1000;
        $user->id_number = 'PM020001';
        $user->first_name = 'Test';
        $user->last_name = 'Manager';
        $user->email = 'pm020001@example.test';
        $user->is_active = true;
        $user->setRelation('role', $role);

        $this->actingAs($user, 'sanctum');
    }

    public function test_worker_assigned_to_another_project_remains_available(): void
    {
        DB::table('workforce_assignment')->insert([
            'laborer_id' => 1,
            'phase_id' => 2,
            'status' => 'Active',
        ]);

        $response = $this->getJson('/api/v1/pm/workforce?project_id=1')
            ->assertOk();

        $available = collect($response->json('available'))->pluck('laborer_id')->all();

        $this->assertContains(1, $available);
        $this->assertSame([], $response->json('assigned'));
    }

    public function test_selected_project_filters_available_and_assigned_workers(): void
    {
        DB::table('workforce_assignment')->insert([
            ['laborer_id' => 1, 'phase_id' => 2, 'status' => 'Active'],
            ['laborer_id' => 2, 'phase_id' => 1, 'status' => 'Active'],
        ]);

        $response = $this->getJson('/api/v1/pm/workforce?project_id=1')
            ->assertOk()
            ->assertJsonPath('assigned.0.laborer_id', 2)
            ->assertJsonPath('assigned.0.phase', 'My Phase');

        $available = collect($response->json('available'))->pluck('laborer_id')->all();
        $assigned = collect($response->json('assigned'))->pluck('laborer_id')->all();

        $this->assertSame([1, 3], $available);
        $this->assertSame([2], $assigned);
    }

    public function test_workforce_rejects_a_project_the_pm_does_not_own(): void
    {
        $this->getJson('/api/v1/pm/workforce?project_id=2')
            ->assertForbidden()
            ->assertJsonPath('message', 'Project not found.');
    }

    public function test_inactive_worker_cannot_be_assigned(): void
    {
        DB::table('laborer')->where('laborer_id', 2)->update(['employment_status' => 'Inactive']);

        $this->postJson('/api/v1/pm/assignments', [
            'laborer_id' => 2,
            'phase_id' => 1,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('laborer_id');

        $this->assertDatabaseMissing('workforce_assignment', [
            'laborer_id' => 2,
            'phase_id' => 1,
        ]);
    }

    public function test_worker_cannot_have_two_active_assignments_in_the_same_project(): void
    {
        DB::table('workforce_assignment')->insert([
            'laborer_id' => 1,
            'phase_id' => 1,
            'status' => 'Active',
        ]);

        $this->postJson('/api/v1/pm/assignments', [
            'laborer_id' => 1,
            'phase_id' => 3,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phase_id');

        $this->assertDatabaseCount('workforce_assignment', 1);
    }

}
