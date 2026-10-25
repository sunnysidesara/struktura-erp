<?php

namespace Tests\Feature\Ss;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SsWorkersVisibilityTest extends TestCase
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
            $table->string('contact_number')->nullable();
        });

        Schema::create('workforce_assignment', function (Blueprint $table) {
            $table->increments('assignment_id');
            $table->unsignedBigInteger('laborer_id');
            $table->unsignedBigInteger('phase_id');
            $table->string('status')->nullable();
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
            'project_id' => 1,
            'project_name' => 'Supervisor Site',
            'site_supervisor_id' => 2000,
        ]);

        DB::table('project_phases')->insert([
            'phase_id' => 1,
            'project_id' => 1,
            'project_name' => 'Site Phase',
        ]);

        DB::table('laborer')->insert([
            [
                'laborer_id' => 1,
                'first_name' => 'Active',
                'last_name' => 'Worker',
                'hourly_rate' => 250,
                'employment_status' => 'Active',
                'contact_number' => '0917-000-0001',
            ],
            [
                'laborer_id' => 2,
                'first_name' => 'Released',
                'last_name' => 'Worker',
                'hourly_rate' => 250,
                'employment_status' => 'Active',
                'contact_number' => '0917-000-0002',
            ],
        ]);

        DB::table('skill')->insert([
            'skill_id' => 1,
            'skill_name' => 'Mason',
        ]);

        DB::table('laborer_skills')->insert([
            'laborer_id' => 1,
            'skill_id' => 1,
        ]);

        DB::table('workforce_assignment')->insert([
            ['laborer_id' => 1, 'phase_id' => 1, 'status' => 'Active'],
            ['laborer_id' => 2, 'phase_id' => 1, 'status' => 'Released'],
        ]);

        $role = new Role(['role_name' => Role::SITE_SUPERVISOR]);
        $user = new User;
        $user->user_id = 2000;
        $user->id_number = 'SUP030001';
        $user->first_name = 'Test';
        $user->last_name = 'Supervisor';
        $user->email = 'sup030001@example.test';
        $user->is_active = true;
        $user->setRelation('role', $role);

        $this->actingAs($user, 'sanctum');
    }

    public function test_site_supervisor_workers_only_include_active_assignments(): void
    {
        $response = $this->getJson('/api/v1/ss/workers?project_id=1')
            ->assertOk()
            ->assertJsonPath('metrics.total', 1)
            ->assertJsonPath('metrics.active', 1)
            ->assertJsonPath('data.0.laborer_id', 1)
            ->assertJsonPath('data.0.name', 'Active Worker');

        $workers = collect($response->json('data'))->pluck('laborer_id')->all();

        $this->assertSame([1], $workers);
    }
}
