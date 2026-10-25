<?php

namespace Tests\Feature\Admin;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminSearchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'users',
            'skill',
            'projects',
            'project_phases',
            'laborer',
            'workforce_assignment',
            'materials',
            'equipment',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        $this->createSearchSchema();

        $role = new Role(['role_name' => Role::ADMIN]);
        $admin = new User;
        $admin->user_id = 999;
        $admin->id_number = 'SYS010001';
        $admin->first_name = 'Test';
        $admin->last_name = 'Admin';
        $admin->email = 'admin@example.test';
        $admin->is_active = true;
        $admin->setRelation('role', $role);

        $this->actingAs($admin, 'sanctum');
    }

    private function createSearchSchema(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->string('id_number');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->boolean('is_active')->default(true);
        });

        Schema::create('skill', function (Blueprint $table) {
            $table->unsignedBigInteger('skill_id')->primary();
            $table->string('skill_name');
            $table->string('description')->nullable();
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->unsignedBigInteger('project_id')->primary();
            $table->string('project_name');
            $table->string('client_name')->nullable();
            $table->string('location')->nullable();
            $table->string('status')->nullable();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->unsignedBigInteger('phase_id')->primary();
            $table->unsignedBigInteger('project_id');
            $table->string('project_name')->nullable();
            $table->string('description')->nullable();
            $table->string('status')->nullable();
        });

        Schema::create('laborer', function (Blueprint $table) {
            $table->unsignedBigInteger('laborer_id')->primary();
            $table->string('first_name');
            $table->string('last_name');
        });

        Schema::create('workforce_assignment', function (Blueprint $table) {
            $table->unsignedBigInteger('assignment_id')->primary();
            $table->unsignedBigInteger('laborer_id');
            $table->unsignedBigInteger('phase_id');
            $table->string('role_on_task')->nullable();
            $table->string('status')->nullable();
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->unsignedBigInteger('material_id')->primary();
            $table->string('material_name');
            $table->string('unit_of_measure')->nullable();
            $table->decimal('unit_cost', 15, 2)->nullable();
            $table->unsignedInteger('stock_quantity')->default(0);
        });

        Schema::create('equipment', function (Blueprint $table) {
            $table->unsignedBigInteger('equipment_id')->primary();
            $table->string('equipment_name');
            $table->string('equipment_type')->nullable();
            $table->decimal('hourly_rental_rate', 15, 2)->nullable();
            $table->string('equipment_status')->nullable();
        });
    }

    private function seedSearchFixtures(): void
    {
        DB::table('users')->insert([
            [
                'user_id' => 1,
                'id_number' => 'SYS010001',
                'first_name' => 'Needle',
                'last_name' => 'User',
                'email' => 'needle@example.test',
                'is_active' => true,
            ],
            [
                'user_id' => 2,
                'id_number' => 'PM020001',
                'first_name' => 'Other',
                'last_name' => 'User',
                'email' => 'other@example.test',
                'is_active' => true,
            ],
        ]);

        DB::table('skill')->insert([
            ['skill_id' => 1, 'skill_name' => 'Needle Skill', 'description' => 'Search fixture'],
            ['skill_id' => 2, 'skill_name' => 'Other Skill', 'description' => null],
        ]);

        DB::table('projects')->insert([
            [
                'project_id' => 1,
                'project_name' => 'Needle Project',
                'client_name' => 'Client',
                'location' => 'Site',
                'status' => 'On Track',
            ],
            [
                'project_id' => 2,
                'project_name' => 'Other Project',
                'client_name' => null,
                'location' => null,
                'status' => 'Completed',
            ],
        ]);

        DB::table('project_phases')->insert([
            [
                'phase_id' => 1,
                'project_id' => 1,
                'project_name' => 'Needle Phase',
                'description' => 'Search fixture',
                'status' => 'In Progress',
            ],
            [
                'phase_id' => 2,
                'project_id' => 2,
                'project_name' => 'Other Phase',
                'description' => null,
                'status' => 'Completed',
            ],
        ]);

        DB::table('laborer')->insert([
            ['laborer_id' => 1, 'first_name' => 'Needle', 'last_name' => 'Worker'],
            ['laborer_id' => 2, 'first_name' => 'Other', 'last_name' => 'Worker'],
        ]);

        DB::table('workforce_assignment')->insert([
            [
                'assignment_id' => 1,
                'laborer_id' => 1,
                'phase_id' => 1,
                'role_on_task' => 'Needle Role',
                'status' => 'Active',
            ],
            [
                'assignment_id' => 2,
                'laborer_id' => 2,
                'phase_id' => 2,
                'role_on_task' => 'Other Role',
                'status' => 'Active',
            ],
        ]);

        DB::table('materials')->insert([
            [
                'material_id' => 1,
                'material_name' => 'Needle Material',
                'unit_of_measure' => 'bags',
                'unit_cost' => 100,
                'stock_quantity' => 25,
            ],
            [
                'material_id' => 2,
                'material_name' => 'Other Material',
                'unit_of_measure' => 'pieces',
                'unit_cost' => 10,
                'stock_quantity' => 5,
            ],
        ]);

        DB::table('equipment')->insert([
            [
                'equipment_id' => 1,
                'equipment_name' => 'Needle Equipment',
                'equipment_type' => 'Excavator',
                'hourly_rental_rate' => 500,
                'equipment_status' => 'Available',
            ],
            [
                'equipment_id' => 2,
                'equipment_name' => 'Other Equipment',
                'equipment_type' => 'Truck',
                'hourly_rental_rate' => 250,
                'equipment_status' => 'In Use',
            ],
        ]);
    }

    public function test_search_returns_all_existing_and_new_groups(): void
    {
        $this->seedSearchFixtures();

        $this->getJson('/api/v1/admin/search?q=Needle')
            ->assertOk()
            ->assertJsonCount(1, 'users')
            ->assertJsonCount(1, 'skills')
            ->assertJsonCount(1, 'projects')
            ->assertJsonCount(1, 'phases')
            ->assertJsonCount(1, 'assignments')
            ->assertJsonCount(1, 'materials')
            ->assertJsonCount(1, 'equipment')
            ->assertJsonPath('phases.0.phase_name', 'Needle Phase')
            ->assertJsonPath('assignments.0.worker', 'Needle Worker')
            ->assertJsonPath('materials.0.material_name', 'Needle Material')
            ->assertJsonPath('equipment.0.equipment_name', 'Needle Equipment');
    }

    public function test_each_search_group_is_limited_to_twenty_rows(): void
    {
        $this->seedSearchFixtures();

        for ($i = 1; $i <= 25; $i++) {
            DB::table('users')->insert([
                'user_id' => 100 + $i,
                'id_number' => 'LIM'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'first_name' => 'Limit',
                'last_name' => 'User',
                'email' => 'limit'.$i.'@example.test',
                'is_active' => true,
            ]);
            DB::table('skill')->insert([
                'skill_id' => 100 + $i,
                'skill_name' => 'Limit Skill '.$i,
                'description' => null,
            ]);
            DB::table('projects')->insert([
                'project_id' => 100 + $i,
                'project_name' => 'Limit Project '.$i,
                'client_name' => null,
                'location' => null,
                'status' => 'On Track',
            ]);
            DB::table('project_phases')->insert([
                'phase_id' => 100 + $i,
                'project_id' => 100 + $i,
                'project_name' => 'Limit Phase '.$i,
                'description' => null,
                'status' => 'In Progress',
            ]);
            DB::table('laborer')->insert([
                'laborer_id' => 100 + $i,
                'first_name' => 'Limit',
                'last_name' => 'Worker',
            ]);
            DB::table('workforce_assignment')->insert([
                'assignment_id' => 100 + $i,
                'laborer_id' => 100 + $i,
                'phase_id' => 100 + $i,
                'role_on_task' => 'Limit Role',
                'status' => 'Active',
            ]);
            DB::table('materials')->insert([
                'material_id' => 100 + $i,
                'material_name' => 'Limit Material '.$i,
                'unit_of_measure' => 'unit',
                'unit_cost' => 1,
                'stock_quantity' => 1,
            ]);
            DB::table('equipment')->insert([
                'equipment_id' => 100 + $i,
                'equipment_name' => 'Limit Equipment '.$i,
                'equipment_type' => 'Type',
                'hourly_rental_rate' => 1,
                'equipment_status' => 'Available',
            ]);
        }

        $this->getJson('/api/v1/admin/search?q=Limit')
            ->assertOk()
            ->assertJsonCount(20, 'users')
            ->assertJsonCount(20, 'skills')
            ->assertJsonCount(20, 'projects')
            ->assertJsonCount(20, 'phases')
            ->assertJsonCount(20, 'assignments')
            ->assertJsonCount(20, 'materials')
            ->assertJsonCount(20, 'equipment');
    }

    public function test_empty_search_returns_all_groups_as_empty_arrays(): void
    {
        $this->getJson('/api/v1/admin/search')
            ->assertOk()
            ->assertExactJson([
                'users' => [],
                'skills' => [],
                'projects' => [],
                'phases' => [],
                'assignments' => [],
                'materials' => [],
                'equipment' => [],
            ]);
    }

    public function test_non_admin_cannot_use_admin_search(): void
    {
        $role = new Role(['role_name' => Role::PROJECT_MANAGER]);
        $manager = new User;
        $manager->user_id = 1000;
        $manager->id_number = 'PM020001';
        $manager->first_name = 'Project';
        $manager->last_name = 'Manager';
        $manager->email = 'pm@example.test';
        $manager->is_active = true;
        $manager->setRelation('role', $role);

        $this->actingAs($manager, 'sanctum')
            ->getJson('/api/v1/admin/search?q=Needle')
            ->assertForbidden();
    }
}
