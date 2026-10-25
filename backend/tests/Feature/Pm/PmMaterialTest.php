<?php

namespace Tests\Feature\Pm;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PmMaterialTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'material_usage',
            'project_phases',
            'materials',
            'projects',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('project_id');
            $table->string('project_name');
            $table->unsignedBigInteger('user_id')->nullable();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->increments('phase_id');
            $table->unsignedBigInteger('project_id');
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->increments('material_id');
            $table->string('material_name');
            $table->string('unit_of_measure')->nullable();
            $table->decimal('unit_cost', 15, 2)->default(0);
            $table->unsignedInteger('stock_quantity')->default(0);
        });

        Schema::create('material_usage', function (Blueprint $table) {
            $table->increments('material_usage_id');
            $table->unsignedBigInteger('material_id');
            $table->unsignedBigInteger('phase_id');
            $table->decimal('quantity_used', 8, 2)->default(0);
        });

        DB::table('projects')->insert([
            'project_id' => 1,
            'project_name' => 'Project Alpha',
            'user_id' => 1000,
        ]);

        DB::table('project_phases')->insert([
            'phase_id' => 1,
            'project_id' => 1,
        ]);

        DB::table('materials')->insert([
            'material_id' => 1,
            'material_name' => 'Cement',
            'unit_of_measure' => 'bags',
            'unit_cost' => 250,
            'stock_quantity' => 100,
        ]);

        DB::table('material_usage')->insert([
            'material_id' => 1,
            'phase_id' => 1,
            'quantity_used' => 3,
        ]);

        $role = new Role(['role_name' => Role::PROJECT_MANAGER]);
        $manager = new User;
        $manager->user_id = 1000;
        $manager->id_number = 'PM020001';
        $manager->first_name = 'Project';
        $manager->last_name = 'Manager';
        $manager->email = 'pm@example.test';
        $manager->is_active = true;
        $manager->setRelation('role', $role);

        $this->actingAs($manager, 'sanctum');
    }

    public function test_pm_materials_endpoint_does_not_publish_supplier_data(): void
    {
        $response = $this->getJson('/api/v1/pm/materials?project_id=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.material_name', 'Cement')
            ->assertJsonMissingPath('data.0.supplier_name');

        $this->assertSame(3.0, (float) $response->json('data.0.used_quantity'));
    }
}
